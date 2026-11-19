// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createSecurityApp, errorHandler } from '../server/security';
import { registerPhotogrammetry, safeModelUrl } from '../server/photogrammetry';
const servers: Server[] = [];
const disposers: (() => void)[] = [];
async function fixture(enabled = true, providerConfigured = true) {
  const env = { ENABLE_POLYCAM: String(enabled), POLYCAM_API_KEY: providerConfigured ? 'test-provider-placeholder' : '' };
  const app = createSecurityApp({ env, verifyToken: async token => ['user-a','user-b'].includes(token) ? { id: token } : null });
  const provider = vi.fn(async () => new Response(JSON.stringify({ id: 'capture-test' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  disposers.push(registerPhotogrammetry(app, env, provider as typeof fetch)); app.use(errorHandler);
  const server = createServer(app); servers.push(server);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${(server.address() as any).port}`, provider };
}
afterEach(async () => { disposers.splice(0).forEach(fn => fn()); await Promise.all(servers.splice(0).map(s => new Promise<void>(r => { s.closeAllConnections(); s.close(() => r()); }))); });
const image = Buffer.from([137,80,78,71,13,10,26,10]);
function form(bytes = image) { const data = new FormData(); data.append('image_0', new Blob([bytes], { type: 'image/png' }), 'untrusted.png'); return data; }
it('rejects model URL SSRF and accepts only exact HTTPS provider hosts', () => {
  for (const value of ['http://127.0.0.1/private', 'https://api.polycam.io.evil.example/model', 'https://api.polycam.io@evil.example/model', 'file:///etc/passwd', 'https://api.polycam.io:8443/model', 'https://' + ['example-user', 'example-password'].join(':') + '@api.polycam.io/model']) expect(safeModelUrl(value)).toBeNull();
  expect(safeModelUrl('https://cdn.polycam.io/model.glb')).toBe('https://cdn.polycam.io/model.glb');
});
it('authenticates before accepting multipart uploads', async () => {
  const { base, provider } = await fixture();
  expect((await fetch(`${base}/api/photogrammetry`, { method: 'POST', body: form() })).status).toBe(401);
  expect(provider).not.toHaveBeenCalled();
});
it('is disabled by default and checks configuration before parsing', async () => {
  for (const args of [[false,true],[true,false]]) {
    const { base, provider } = await fixture(...args as [boolean,boolean]);
    expect((await fetch(`${base}/api/photogrammetry`, { method: 'POST', headers: { Authorization: 'Bearer user-a', 'Content-Type': 'multipart/form-data; boundary=broken' }, body: 'invalid multipart' })).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  }
});
it('validates real file bytes and enforces per-file size', async () => {
  const { base, provider } = await fixture();
  for (const [bytes, status] of [[Buffer.from('<script>not an image</script>'),400],[Buffer.alloc(2*1024*1024+1),413]] as const) {
    expect((await fetch(`${base}/api/photogrammetry`, { method: 'POST', headers: { Authorization: 'Bearer user-a' }, body: form(bytes) })).status).toBe(status);
  }
  expect(provider).not.toHaveBeenCalled();
});
it('assigns unpredictable job IDs and enforces owner reads/downloads', async () => {
  const { base } = await fixture();
  const response = await fetch(`${base}/api/photogrammetry`, { method: 'POST', headers: { Authorization: 'Bearer user-a' }, body: form() });
  expect(response.status).toBe(200);
  const { jobId } = await response.json(); expect(jobId).toMatch(/^[0-9a-f-]{36}$/);
  expect((await fetch(`${base}/api/photogrammetry/${jobId}`, { headers: { Authorization: 'Bearer user-a' } })).status).toBe(200);
  expect((await fetch(`${base}/api/photogrammetry/${jobId}`, { headers: { Authorization: 'Bearer user-b' } })).status).toBe(404);
  expect((await fetch(`${base}/api/photogrammetry/models/${jobId}.glb`, { headers: { Authorization: 'Bearer user-b' } })).status).toBe(404);
});
