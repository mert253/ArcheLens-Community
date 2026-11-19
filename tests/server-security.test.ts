// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { createSecurityApp, errorHandler, imageSchema, withPostAdmission, type SecurityOptions } from '../server/security';

const servers: Server[] = [];
async function fixture(
  env: Record<string, string> = {},
  verifyToken?: SecurityOptions['verifyToken'],
  work?: () => Promise<void>,
) {
  const app = createSecurityApp({ env, verifyToken });
  app.get('/api/private', (_req, res) => res.json({ user: res.locals.user.id }));
  app.post('/api/image', (req, res) => { imageSchema.parse(req.body); res.json({ ok: true }); });
  app.all('/api/body-policy', (req, res) => res.json({ parsed: req.body !== undefined }));
  if (work) {
    app.post('/api/work', withPostAdmission(async (_req, res) => {
      res.sendStatus(204);
      await work();
    }));
  }
  app.get('/api/failure', () => { throw new Error('PRIVATE_PROVIDER_DETAIL'); });
  app.use(errorHandler);
  const server = createServer(app); servers.push(server);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as any).port}`;
}
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(r => { s.closeAllConnections(); s.close(() => r()); }))); });

describe('backend trust boundaries', () => {
  it('fails closed by default and ignores a forged loopback forwarded address', async () => {
    const base = await fixture();
    const response = await fetch(`${base}/api/private`, { headers: { 'X-Forwarded-For': '127.0.0.1' } });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
  it('verifies bearer tokens and rejects invalid ones', async () => {
    const base = await fixture({}, async token => token === 'example-invalid-token' ? { id: 'user-a' } : null);
    expect((await fetch(`${base}/api/private`, { headers: { Authorization: 'Bearer invalid' } })).status).toBe(401);
    expect(await (await fetch(`${base}/api/private`, { headers: { Authorization: 'Bearer example-invalid-token' } })).json()).toEqual({ user: 'user-a' });
  });
  it('requires a permanent account for hosted authentication', async () => {
    const base = await fixture({}, async token => ({
      id: 'account',
      is_anonymous: token === 'test-token',
    }));
    const guest = await fetch(`${base}/api/private`, { headers: { Authorization: 'Bearer test-token' } });
    expect(guest.status).toBe(401);
    const member = await fetch(`${base}/api/private`, { headers: { Authorization: 'Bearer dummy-token' } });
    expect(member.status).toBe(200);
    expect(await member.json()).toEqual({ user: 'account' });
  });
  it('allows explicit loopback mode but blocks rebinding and null/arbitrary origins', async () => {
    const base = await fixture({ AUTH_MODE: 'local', HOST: '127.0.0.1' });
    expect((await fetch(`${base}/api/private`)).status).toBe(200);
    for (const origin of ['null', 'https://evil.example', 'http://localhost:9999']) {
      expect((await fetch(`${base}/api/private`, { headers: { Origin: origin } })).status).toBe(403);
    }
    const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${base}/api/private`, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    expect(hostStatus).toBe(403);
    expect((await fetch(`${base}/api/private`, { headers: { Origin: 'http://localhost:3000' } })).status).toBe(200);
  });
  it('refuses local authentication on an externally bound listener', () => {
    expect(() => createSecurityApp({ env: { AUTH_MODE: 'local', HOST: '0.0.0.0' } })).toThrow();
  });
  it('never uses secret/service-role keys as the public authentication client', async () => {
    const serviceRole = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
    for (const key of ['sb_secret_placeholder', serviceRole]) {
      const base = await fixture({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: key });
      expect((await fetch(`${base}/api/private`, { headers: { Authorization: 'Bearer example-invalid-token' } })).status).toBe(503);
    }
  });
  it('authenticates before attempting JSON parsing', async () => {
    const base = await fixture();
    const response = await fetch(`${base}/api/image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
    expect(response.status).toBe(401);
  });
  it('parses JSON only for POST requests', async () => {
    const base = await fixture({ AUTH_MODE: 'local' });
    const send = (method: string) => fetch(`${base}/api/body-policy`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample: 'value' }),
    });
    expect(await (await send('PUT')).json()).toEqual({ parsed: false });
    expect(await (await send('POST')).json()).toEqual({ parsed: true });
  });
  it('holds admission through handler settlement after the response finishes', async () => {
    let finishWork = () => {};
    const pendingWork = new Promise<void>(resolve => { finishWork = resolve; });
    const base = await fixture({ AUTH_MODE: 'local' }, undefined, () => pendingWork);
    const submit = () => fetch(`${base}/api/work`, { method: 'POST' });
    try {
      expect((await submit()).status).toBe(204);
      expect((await submit()).status).toBe(204);
      expect((await submit()).status).toBe(429);
    } finally {
      finishWork();
    }
    expect((await submit()).status).toBe(204);
  });
  it('rejects MIME/signature mismatches and excessive images', async () => {
    const base = await fixture({ AUTH_MODE: 'local' });
    const send = (body: unknown) => fetch(`${base}/api/image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect((await send({ mimeType: 'image/png', data: Buffer.from('not-an-image').toString('base64') })).status).toBe(400);
    expect((await send({ mimeType: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64') })).status).toBe(400);
    expect((await send({ mimeType: 'image/png', data: Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64') })).status).toBe(400);
    expect((await send({ mimeType: 'image/png', data: Buffer.from([137,80,78,71,13,10,26,10]).toString('base64') })).status).toBe(200);
  });
  it('never exposes upstream exception details', async () => {
    const base = await fixture({ AUTH_MODE: 'local' });
    const response = await fetch(`${base}/api/failure`);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('PRIVATE_PROVIDER_DETAIL');
  });
  it('enforces a restrictive production CSP on HTTP responses', async () => {
    const base = await fixture({ AUTH_MODE: 'local', NODE_ENV: 'production', VITE_SUPABASE_URL: 'https://example.supabase.co' });
    const response = await fetch(`${base}/api/health`);
    const policy = response.headers.get('content-security-policy') || '';
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("https://example.supabase.co");
    expect(policy).toContain("wss://example.supabase.co");
    expect(policy).toContain("https://collectionapi.metmuseum.org");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/img-src[^;]*\*/);
    expect(policy).not.toMatch(/connect-src[^;]*\shttps?:\s/);
  });
  it('does not enforce production CSP on development health requests', async () => {
    const base = await fixture({ AUTH_MODE: 'local', NODE_ENV: 'development' });
    expect((await fetch(`${base}/api/health`)).headers.get('content-security-policy')).toBeNull();
  });

});
