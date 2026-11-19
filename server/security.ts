import express, { type ErrorRequestHandler, type RequestHandler, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export type Environment = Record<string, string | undefined>;
export interface SecurityOptions {
  env?: Environment;
  verifyToken?: (token: string) => Promise<{ id: string; is_anonymous?: boolean } | null>;
}
export class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

const postAdmissions = new WeakMap<Response, { running: boolean; release: () => void }>();

/** Hold the admission slot until asynchronous route work settles. */
export function withPostAdmission(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    if (res.destroyed) return;
    const admission = postAdmissions.get(res);
    if (admission) admission.running = true;
    try {
      await handler(req, res, next);
    } finally {
      admission?.release();
    }
  };
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const rasterMime = z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export function matchesImageSignature(bytes: Buffer, mime: string) {
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/gif') return ['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
  return mime === 'image/webp' && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}
export const base64Image = z.string().min(4).max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
  .refine(v => Buffer.byteLength(v, 'base64') <= MAX_IMAGE_BYTES, 'Image is too large');
export const imageSchema = z.object({ mimeType: rasterMime, data: base64Image })
  .refine(v => matchesImageSignature(Buffer.from(v.data, 'base64'), v.mimeType), 'Image signature does not match its MIME type');
export function validateOptionalImage(v: { imageData?: string; mimeType?: string }, ctx: z.RefinementCtx) {
  if (v.imageData && !imageSchema.safeParse({ data: v.imageData, mimeType: v.mimeType || 'image/jpeg' }).success)
    ctx.addIssue({ code: 'custom', path: ['imageData'], message: 'Invalid raster image' });
}
export function isLoopback(address: string | undefined) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '');
}
function safePublicKey(key: string) {
  if (key.startsWith('sb_secret_')) return false;
  if (key.startsWith('eyJ')) {
    try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
    catch { return false; }
  }
  return key.startsWith('sb_publishable_');
}
/** Strict hosted CSP. External hosts are reviewed, explicit origins only. */
export function productionContentSecurityPolicy(env: Environment): string {
  const connect = [
    "'self'",
    'https://collectionapi.metmuseum.org',
    'https://en.wikipedia.org',
    'https://huggingface.co',
    'https://cdn-lfs.huggingface.co',
    'https://cdn-lfs-us-1.hf.co',
    'https://cas-bridge.xethub.hf.co',
    'https://raw.githubusercontent.com',
    'https://cdn.jsdelivr.net',
    'https://market-assets.fra1.cdn.digitaloceanspaces.com',
  ];
  const supabase = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (supabase) {
    const parsed = new URL(supabase);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      throw new Error('Production Supabase URL must be a credential-free HTTPS origin');
    connect.push(parsed.origin, `wss://${parsed.host}`);
  }
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://images.metmuseum.org https://upload.wikimedia.org https://market-assets.fra1.cdn.digitaloceanspaces.com",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: data:",
    "manifest-src 'self'",
  ].join('; ');
}

export function createSecurityApp(options: SecurityOptions = {}) {
  const env = options.env || process.env;
  const authMode = env.AUTH_MODE || 'supabase';
  const host = env.HOST || '127.0.0.1';
  if (!['local', 'supabase'].includes(authMode)) throw new Error('AUTH_MODE must be supabase or local');
  if (authMode === 'local' && !['127.0.0.1', '::1'].includes(host)) throw new Error('Local mode requires an explicit loopback HOST');
  const allowedOrigins = (env.CLIENT_URL || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);
  for (const value of allowedOrigins) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password)
      throw new Error('CLIENT_URL must contain exact HTTP(S) origins');
    if (authMode === 'local' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('Local mode permits loopback CLIENT_URL origins only');
  }
  const app = express();
  app.disable('x-powered-by');
  if (env.NODE_ENV === 'production') {
    const csp = productionContentSecurityPolicy(env);
    app.use((_req, res, next) => { res.setHeader('Content-Security-Policy', csp); next(); });
  }
  const proxyCount = Number(env.TRUST_PROXY || '0');
  if (!Number.isInteger(proxyCount) || proxyCount < 0 || proxyCount > 5) throw new Error('TRUST_PROXY must be an integer between 0 and 5');
  app.set('trust proxy', proxyCount || false);
  app.locals.authMode = authMode;
  app.locals.host = host;
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  // Socket identity and the Host header are checked independently of forwarded headers.
  app.use((req, res, next) => {
    if (authMode === 'local' && (!isLoopback(req.socket.remoteAddress) || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(req.headers.host || '')))
      return res.status(403).json({ error_code: 'LOCAL_ACCESS_ONLY', message: 'Local access required.' });
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error_code: 'ORIGIN_DENIED', message: 'Origin is not allowed.' });
    next();
  });
  app.use(cors({ origin: allowedOrigins, credentials: false, allowedHeaders: ['Content-Type', 'Authorization', 'Accept'], methods: ['GET','POST','OPTIONS'], maxAge: 600 }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/setup/status', (_req, res) => res.json({ configured: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'YOUR_KEY_HERE'), authMode }));

  // Removed configuration mutation/inspection endpoints are always refused, including in local mode.
  app.all(['/api/setup/save', '/api/setup/keys', '/api/internal/set-key', '/api/internal/sync-analysis'], (_req, res) => res.status(404).json({ error_code: 'NOT_FOUND', message: 'Endpoint not found.' }));
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  let verifyToken = options.verifyToken;
  if (!verifyToken && supabaseUrl && publicKey && safePublicKey(publicKey)) {
    const url = new URL(supabaseUrl);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))))
      throw new Error('Supabase authentication requires HTTPS or a local development endpoint');
    const sb = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    } });
    verifyToken = async token => {
      const { data, error } = await sb.auth.getUser(token);
      return error ? null : data.user;
    };
  }
  const requireAuth: RequestHandler = async (req, res, next) => {
    if (authMode === 'local') { res.locals.user = { id: 'local' }; return next(); }
    const match = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Authentication required.' });
    if (!verifyToken) return res.status(503).json({ error_code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured.' });
    try {
      const user = await verifyToken(match[1]);
      if (!user || user.is_anonymous) return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid session.' });
      res.locals.user = { id: user.id }; next();
    } catch { res.status(503).json({ error_code: 'AUTH_UNAVAILABLE', message: 'Authentication is temporarily unavailable.' }); }
  };
  // Apply a socket/IP limit before auth network requests, and a user limit afterwards.
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false, message: { error_code: 'RATE_LIMITED', message: 'Too many requests.' } }), requireAuth);
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, keyGenerator: (_req, res) => res.locals.user.id, standardHeaders: 'draft-8', legacyHeaders: false, message: { error_code: 'RATE_LIMITED', message: 'Too many requests.' } }));
  let activeRequests = 0;
  const requestsByUser = new Map<string, number>();
  const parseJson = express.json({ limit: '12mb', strict: true });
  app.use('/api', (req, res, next) => {
    if (req.method !== 'POST') return next();
    if (res.destroyed) return;
    const id = res.locals.user.id;
    const count = requestsByUser.get(id) || 0;
    if (activeRequests >= 8 || count >= 2) return res.status(429).json({ error_code: 'SERVER_BUSY', message: 'Too many concurrent requests.' });
    activeRequests++; requestsByUser.set(id, count + 1);
    const admission = {
      running: false,
      release: () => {
        if (!postAdmissions.delete(res)) return;
        activeRequests--;
        const remaining = (requestsByUser.get(id) || 1) - 1;
        if (remaining) requestsByUser.set(id, remaining); else requestsByUser.delete(id);
      },
    };
    postAdmissions.set(res, admission);
    const releaseIfUnclaimed = () => {
      if (!admission.running) admission.release();
    };
    res.once('finish', releaseIfUnclaimed);
    res.once('close', releaseIfUnclaimed);
    parseJson(req, res, next);
  });
  return app;
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) { res.destroy(); return; }
  const isValidation = error instanceof z.ZodError || error?.type === 'entity.parse.failed';
  const isLarge = error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE' || error?.code === 'LIMIT_FILE_COUNT' || error?.code === 'LIMIT_PART_COUNT' || error?.code === 'LIMIT_FIELD_VALUE';
  const status = error instanceof HttpError ? error.status : isLarge ? 413 : isValidation || error?.name === 'MulterError' ? 400 : error?.message === 'SETUP_REQUIRED' ? 503 : 500;
  const code = error instanceof HttpError ? error.code : isLarge ? 'PAYLOAD_TOO_LARGE' : isValidation ? 'VALIDATION_FAILED' : error?.message === 'SETUP_REQUIRED' ? 'SETUP_REQUIRED' : status === 400 ? 'INVALID_UPLOAD' : 'SERVER_ERROR';
  const message = status === 503 ? 'The requested service is not configured or temporarily unavailable.' : status === 413 ? 'Payload exceeds the allowed limit.' : status === 400 ? 'Invalid request data.' : status === 404 ? 'Resource not found.' : status === 429 ? 'Too many requests.' : 'The request could not be completed.';
  res.status(status).json({ error_code: code, message });
};
