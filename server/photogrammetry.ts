import type { Express, Request } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdtemp, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError, matchesImageSignature, MAX_IMAGE_BYTES, withPostAdmission, type Environment } from './security';

const PROVIDER = 'https://api.polycam.io/api/v1';
const MODEL_HOSTS = new Set(['api.polycam.io', 'storage.polycam.io', 'cdn.polycam.io']);
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_MODEL_BYTES = 64 * 1024 * 1024;
const JOB_TTL = 60 * 60 * 1000;
interface UploadState {
  directory: string;
  bytes: number;
  storageOperations: Set<Promise<void>>;
}
interface UploadRequest extends Request { uploadState?: UploadState }
interface Job {
  ownerId: string; providerId: string; createdAt: number; status: 'queued'|'processing'|'completed'|'failed';
  progress: number; message: string; remoteUrl?: string; timer?: ReturnType<typeof setTimeout>; controller?: AbortController;
}
export function safeModelUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && MODEL_HOSTS.has(url.hostname) && (!url.port || url.port === '443') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
async function jsonResponse(response: globalThis.Response) {
  if (!response.ok || !response.body) throw new HttpError(502, 'PROVIDER_UNAVAILABLE');
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > 1024 * 1024) throw new HttpError(502, 'PROVIDER_RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}
function trackStorageOperation(state: UploadState, operation: Promise<void>) {
  state.storageOperations.add(operation);
  const forget = () => { state.storageOperations.delete(operation); };
  void operation.then(forget, forget);
}

const storage: multer.StorageEngine = {
  _handleFile(req: UploadRequest, file, callback) {
    const upload = req.uploadState!;
    const filename = randomUUID(); const filePath = path.join(upload.directory, filename);
    const destination = createWriteStream(filePath, { flags: 'wx', mode: 0o600 }); let size = 0;
    const meter = new Transform({ transform(chunk, _encoding, done) {
      size += chunk.length; upload.bytes += chunk.length;
      if (upload.bytes > MAX_TOTAL_BYTES) done(new HttpError(413, 'UPLOAD_TOTAL_TOO_LARGE'));
      else done(null, chunk);
    } });
    const abort = () => file.stream.destroy(new HttpError(400, 'UPLOAD_ABORTED'));
    req.once('aborted', abort);
    const operation = pipeline(file.stream, meter, destination).then(() => {
      req.removeListener('aborted', abort); callback(null, { destination: upload.directory, filename, path: filePath, size });
    }, error => { req.removeListener('aborted', abort); callback(error); });
    trackStorageOperation(upload, operation);
  },
  _removeFile(req, file, callback) {
    const upload = (req as UploadRequest).uploadState!;
    trackStorageOperation(upload, rm(file.path, { force: true }).then(() => callback(null), callback));
  },
};

export function registerPhotogrammetry(app: Express, env: Environment, providerFetch: typeof fetch = fetch): () => void {
  const jobs = new Map<string, Job>(); const activeUploads = new Set<string>(); let downloads = 0; let disposed = false;
  function prune() {
    for (const [id, job] of jobs) if (Date.now() - job.createdAt > JOB_TTL) { clearTimeout(job.timer); job.controller?.abort(); jobs.delete(id); }
  }
  async function providerJson(url: string, init: RequestInit, job?: Job) {
    const controller = new AbortController(); if (job) job.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try { return await jsonResponse(await providerFetch(url, { ...init, redirect: 'error', signal: controller.signal })); }
    finally { clearTimeout(timeout); if (job) job.controller = undefined; }
  }
  function poll(id: string) {
    const job = jobs.get(id); if (!job || disposed) return;
    job.timer = setTimeout(async () => {
      if (disposed || !jobs.has(id)) return;
      if (Date.now() - job.createdAt > 10 * 60 * 1000) { job.status = 'failed'; job.message = 'Processing timed out.'; return; }
      try {
        const data = await providerJson(`${PROVIDER}/captures/${encodeURIComponent(job.providerId)}`, { headers: { Authorization: `Token ${env.POLYCAM_API_KEY}` } }, job);
        const state = String(data.state || data.status || '').toLowerCase();
        if (['completed','done'].includes(state)) {
          const url = safeModelUrl(data.model_url || data.glb_url || data.export?.glb);
          if (!url) throw new Error('Untrusted model URL');
          job.remoteUrl = url; job.status = 'completed'; job.progress = 100; job.message = 'Model ready.'; return;
        }
        if (['failed','error'].includes(state)) throw new Error('Provider failed');
        job.status = 'processing'; job.progress = Number.isFinite(data.progress) ? Math.min(95, Math.max(0, data.progress)) : 50; job.message = 'Processing.';
        poll(id);
      } catch { job.status = 'failed'; job.message = 'Provider processing failed.'; }
    }, 10_000);
    job.timer.unref();
  }
  const parseUpload = multer({ storage, limits: { fileSize: MAX_IMAGE_BYTES, files: 50, fields: 0, parts: 50, fieldNameSize: 100, headerPairs: 20 },
    fileFilter: (_req, file, callback) => {
      if (['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype)) callback(null, true);
      else callback(new HttpError(400, 'INVALID_IMAGE'));
    },
  }).any();
  app.post('/api/photogrammetry', withPostAdmission(async (request, res, next) => {
    const req = request as UploadRequest; prune();
    if (env.ENABLE_POLYCAM !== 'true' || !env.POLYCAM_API_KEY) return next(new HttpError(503, 'PHOTOGRAMMETRY_DISABLED'));
    const ownerId = res.locals.user.id;
    const pending = [...jobs.values()].filter(j => j.status === 'queued' || j.status === 'processing');
    if (activeUploads.size >= 2 || activeUploads.has(ownerId) || pending.length + activeUploads.size >= 8 ||
      pending.filter(j => j.ownerId === ownerId).length >= 2 || jobs.size + activeUploads.size >= 1000)
      return next(new HttpError(429, 'PHOTOGRAMMETRY_BUSY'));
    activeUploads.add(ownerId);
    let directory = ''; let aborted = false; const controller = new AbortController();
    const onClose = () => { if (!res.writableEnded) { aborted = true; controller.abort(); } };
    res.once('close', onClose);
    const timer = setTimeout(() => { aborted = true; controller.abort(); req.destroy(); }, 90_000);
    try {
      directory = await mkdtemp(path.join(tmpdir(), 'archelens-upload-'));
      if (aborted || req.destroyed || res.destroyed) throw new HttpError(400, 'UPLOAD_ABORTED');
      req.uploadState = { directory, bytes: 0, storageOperations: new Set() };
      await new Promise<void>((resolve, reject) => {
        parseUpload(req, res, error => { error ? reject(error) : resolve(); });
      });
      if (aborted) throw new HttpError(400, 'UPLOAD_ABORTED');
      const files = req.files as Express.Multer.File[];
      if (!files?.length) throw new HttpError(400, 'NO_IMAGES');
      const form = new FormData(); form.append('type', 'lidar');
      for (const file of files) {
        const handle = await open(file.path, 'r'); const signature = Buffer.alloc(12);
        try { await handle.read(signature, 0, 12, 0); } finally { await handle.close(); }
        if (!matchesImageSignature(signature, file.mimetype)) throw new HttpError(400, 'INVALID_IMAGE');
        form.append('images', await openAsBlob(file.path, { type: file.mimetype }), `${file.filename}.${file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1]}`);
      }
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let data: any;
      try { data = await jsonResponse(await providerFetch(`${PROVIDER}/captures/`, { method: 'POST', headers: { Authorization: `Token ${env.POLYCAM_API_KEY}` }, body: form, signal: controller.signal, redirect: 'error' })); }
      finally { clearTimeout(timeout); }
      const providerId = String(data.id || data.job_id || data.capture_id || '');
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(providerId) || aborted) throw new HttpError(502, 'INVALID_PROVIDER_RESPONSE');
      const jobId = randomUUID(); jobs.set(jobId, { ownerId, providerId, createdAt: Date.now(), status: 'queued', progress: 0, message: 'Queued for processing.' }); poll(jobId);
      res.json({ jobId });
    } catch (error) { if (!aborted && !res.destroyed && !req.aborted) next(error instanceof HttpError || (error as any)?.name === 'MulterError' ? error : new HttpError(502, 'PROVIDER_UNAVAILABLE')); }
    finally {
      clearTimeout(timer);
      res.removeListener('close', onClose);
      try {
        // Multer can return on disconnect before pending writes or removals finish.
        const operations = req.uploadState?.storageOperations;
        while (operations?.size) await Promise.allSettled(operations);
        if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
      } finally {
        activeUploads.delete(ownerId);
      }
    }
  }));
  app.get('/api/photogrammetry/:jobId', (req, res, next) => {
    prune(); const id = String(req.params.jobId); const job = jobs.get(id);
    if (!job || job.ownerId !== res.locals.user.id) return next(new HttpError(404, 'NOT_FOUND'));
    res.json({ jobId: id, status: job.status, progress: job.progress, message: job.message, ...(job.status === 'completed' ? { glbUrl: `/api/photogrammetry/models/${id}.glb` } : {}) });
  });
  app.get('/api/photogrammetry/models/:filename', async (req, res, next) => {
    prune(); const filename = String(req.params.filename);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.glb$/.test(filename)) return next(new HttpError(404, 'NOT_FOUND'));
    const job = jobs.get(filename.slice(0, -4));
    if (!job || job.ownerId !== res.locals.user.id || job.status !== 'completed' || !safeModelUrl(job.remoteUrl)) return next(new HttpError(404, 'NOT_FOUND'));
    if (downloads >= 2) return next(new HttpError(429, 'DOWNLOAD_BUSY'));
    downloads++; const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
    const onClose = () => { if (!res.writableEnded) controller.abort(); }; res.once('close', onClose);
    try {
      const remote = await providerFetch(job.remoteUrl!, { redirect: 'error', signal: controller.signal });
      if (!remote.ok || !remote.body || Number(remote.headers.get('content-length')) > MAX_MODEL_BYTES) throw new HttpError(502, 'MODEL_UNAVAILABLE');
      let bytes = 0; let prefix = Buffer.alloc(0); let checked = false;
      const limit = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length; if (bytes > MAX_MODEL_BYTES) return callback(new HttpError(502, 'MODEL_TOO_LARGE'));
        if (!checked) {
          prefix = Buffer.concat([prefix, chunk]); if (prefix.length < 4) return callback();
          if (prefix.subarray(0, 4).toString('ascii') !== 'glTF') return callback(new HttpError(502, 'INVALID_MODEL'));
          checked = true; callback(null, prefix); prefix = Buffer.alloc(0);
        } else callback(null, chunk);
      }, flush(callback) { callback(checked ? undefined : new HttpError(502, 'INVALID_MODEL')); } });
      res.setHeader('Content-Type', 'model/gltf-binary'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await pipeline(Readable.fromWeb(remote.body as any), limit, res, { signal: controller.signal });
    } catch (error) { if (!res.destroyed) next(error instanceof HttpError ? error : new HttpError(502, 'MODEL_UNAVAILABLE')); }
    finally { downloads--; clearTimeout(timeout); res.removeListener('close', onClose); }
  });
  return () => { disposed = true; for (const job of jobs.values()) { clearTimeout(job.timer); job.controller?.abort(); } jobs.clear(); };
}
