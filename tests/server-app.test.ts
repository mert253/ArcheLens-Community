// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, type AppOptions } from '../server';
const resources: { server: Server; dispose: () => void }[] = [];
const directories: string[] = [];
async function fixture(options: AppOptions = {}) {
  const app = createApp({ env: { AUTH_MODE: 'local' }, ...options });
  const server = createServer(app); resources.push({ server, dispose: app.locals.dispose });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as any).port}`;
}
afterEach(async () => {
  await Promise.all(resources.splice(0).map(({ server, dispose }) => { dispose(); return new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); }); }));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});
const png = Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
const body = { images: [{ mimeType: 'image/png', data: png }], lang: 'en' };
const post = (base: string, route: string, value: unknown) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

describe('production application', () => {
  it('retains safe setup status and refuses all configuration mutation routes', async () => {
    const base = await fixture();
    expect(await (await fetch(base + '/api/setup/status')).json()).toEqual({ configured: false, authMode: 'local' });
    for (const route of ['/api/setup/save','/api/setup/keys','/api/internal/set-key','/api/internal/sync-analysis']) {
      expect((await post(base, route, { GEMINI_API_KEY: 'test-placeholder' })).status).toBe(404);
    }
    expect((await fetch(base + '/api/setup/keys')).status).toBe(404);
  });
  it('preserves analysis while validating requests and applying provider timeouts', async () => {
    const generateContent = vi.fn(async () => ({ response: { text: () => JSON.stringify({ title: 'Test artifact', analysis: { description: 'A test report.' } }) } }));
    const getGenerativeModel = vi.fn(() => ({ generateContent }));
    const base = await fixture({ ai: { getGenerativeModel } as any });
    const good = await post(base, '/api/analyze', body);
    expect(good.status).toBe(200); expect((await good.json()).title).toBe('Test artifact');
    expect(getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-pro' }, { timeout: 120_000 });
    expect((await post(base, '/api/analyze', { ...body, cvSummary: 'x'.repeat(501) })).status).toBe(400);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it('supports configurable GEMINI_MODEL and falls back when a model is unavailable', async () => {
    const getGenerativeModel = vi.fn(({ model }: { model: string }) => ({
      generateContent: vi.fn(async () => {
        if (model === 'unavailable-preview-model') {
          throw new Error('404 Not Found: models/unavailable-preview-model is not found for API version v1beta');
        }
        return { response: { text: () => JSON.stringify({ title: `Analyzed by ${model}` }) } };
      }),
    }));
    const base = await fixture({
      env: { AUTH_MODE: 'local', GEMINI_MODEL: 'unavailable-preview-model', GEMINI_FALLBACK_MODELS: ' , gemini-2.5-flash , gemini-2.5-pro , ' },
      ai: { getGenerativeModel } as any,
    });
    const res = await post(base, '/api/analyze', body);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('Analyzed by gemini-2.5-flash');
    expect(getGenerativeModel).toHaveBeenNthCalledWith(1, { model: 'unavailable-preview-model' }, { timeout: 120_000 });
    expect(getGenerativeModel).toHaveBeenNthCalledWith(2, { model: 'gemini-2.5-flash' }, { timeout: 120_000 });
  });
  it('does not retry fallback models on non-404 errors even when error URL contains models/', async () => {
    const getGenerativeModel = vi.fn(() => ({
      generateContent: vi.fn(async () => {
        throw new Error('Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent: [429 Too Many Requests] Quota exceeded');
      }),
    }));
    const base = await fixture({
      env: { AUTH_MODE: 'local', GEMINI_MODEL: 'gemini-2.5-pro', GEMINI_FALLBACK_MODELS: 'gemini-2.5-flash,gemini-2.0-flash' },
      ai: { getGenerativeModel } as any,
    });
    const res = await post(base, '/api/analyze', body);
    expect(res.status).toBe(500);
    expect(getGenerativeModel).toHaveBeenCalledTimes(1);
  });
  it('applies model fallback to /api/chat and /api/compare without extra probe calls', async () => {
    const getGenerativeModel = vi.fn(({ model }: { model: string }) => ({
      startChat: vi.fn(() => ({
        sendMessage: vi.fn(async () => {
          if (model === 'retired-model') {
            throw new Error('404 Not Found: models/retired-model is not found');
          }
          return { response: { text: () => `Chat reply from ${model}` } };
        }),
      })),
      generateContent: vi.fn(async () => ({
        response: { text: () => `<ANALYSIS_JSON>{"similarity_score":88,"conclusion":"Compared by ${model}"}</ANALYSIS_JSON>` },
      })),
    }));
    const base = await fixture({
      env: { AUTH_MODE: 'local', GEMINI_MODEL: 'retired-model', GEMINI_FALLBACK_MODELS: 'gemini-2.5-flash' },
      ai: { getGenerativeModel } as any,
    });
    const chatRes = await post(base, '/api/chat', { message: 'Hello archaeologist' });
    expect(chatRes.status).toBe(200);
    expect((await chatRes.json()).reply).toBe('Chat reply from gemini-2.5-flash');
    expect(getGenerativeModel).toHaveBeenCalledTimes(2);

    const compareRes = await post(base, '/api/compare', {
      images: [
        { mimeType: 'image/png', data: png },
        { mimeType: 'image/png', data: png },
      ],
      lang: 'en',
    });
    expect(compareRes.status).toBe(200);
    expect((await compareRes.json()).conclusion).toBe('Compared by gemini-2.5-flash');
    // Uses cached gemini-2.5-flash directly without any extra probe call
    expect(getGenerativeModel).toHaveBeenCalledTimes(3);
  });
  it('does not return upstream errors or convert provider failure into success', async () => {
    const base = await fixture({ ai: { getGenerativeModel: () => ({ generateContent: async () => { throw new Error('PRIVATE_UPSTREAM_CREDENTIAL_DETAIL'); } }) } as any });
    const response = await post(base, '/api/analyze', body);
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('PRIVATE_UPSTREAM');
  });
  it('keeps restoration images, evidence, and input MIME behavior', async () => {
    const generateContent = vi.fn()
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ evidence: [{ name: 'Reference' }], confidence_score: 75 }) } })
      .mockResolvedValueOnce({ response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] } });
    const base = await fixture({ ai: { getGenerativeModel: () => ({ generateContent }) } as any });
    const response = await post(base, '/api/restore', { imageData: png, mimeType: 'image/png' });
    const result = await response.json(); expect(response.status).toBe(200);
    expect(result.imageGenerated).toBe(true); expect(result.restoredImage).toBe(`data:image/png;base64,${png}`); expect(result.evidenceConfidenceScore).toBe(75);
    expect(generateContent.mock.calls[0][0].contents[0].parts[0].inlineData.mimeType).toBe('image/png');
  });
  it('keeps cross-reference cache state private to each authenticated user', async () => {
    const providerFetch = vi.fn<typeof fetch>(async () => Response.json({ objectIDs: [] }));
    const base = await fixture({
      env: {},
      verifyToken: async token => ({ id: token }),
      providerFetch,
    });
    const lookup = async (token: string) => {
      const response = await fetch(base + '/api/cross-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ material: 'Terracotta' }),
      });
      expect(response.status).toBe(200);
      return response.json();
    };
    expect(await lookup('user-a')).toEqual({ results: [] });
    expect(await lookup('user-a')).toEqual({ results: [], cached: true });
    expect(await lookup('user-b')).toEqual({ results: [] });
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });
  it('serves SPA routes with Express 5 and never falls back for unknown API paths or dotfiles', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'archelens-static-test-')); directories.push(directory);
    await mkdir(path.join(directory, 'dist'));
    await writeFile(path.join(directory, 'dist', 'index.html'), '<html>Application shell</html>');
    await writeFile(path.join(directory, 'dist', '.env.local'), 'PRIVATE_STATIC_VALUE');
    await writeFile(path.join(directory, 'package.json'), 'PRIVATE_PACKAGE_VALUE');
    const base = await fixture({ env: { AUTH_MODE: 'local', STATIC_DIR: path.join(directory, 'dist') }, staticApplicationRoot: directory });
    expect(await (await fetch(base + '/workspace/example')).text()).toContain('Application shell');
    expect((await fetch(base + '/api/unknown')).status).toBe(404);
    expect(await (await fetch(base + '/.env.local')).text()).not.toContain('PRIVATE_STATIC_VALUE');
    expect(await (await fetch(base + '/package.json')).text()).not.toContain('PRIVATE_PACKAGE_VALUE');
  });
  it('protects production SPA pages with the same content security policy', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'archelens-csp-test-')); directories.push(directory);
    await mkdir(path.join(directory, 'dist'));
    await writeFile(path.join(directory, 'dist', 'index.html'), '<html>Shell</html>');
    const base = await fixture({ env: { AUTH_MODE: 'local', NODE_ENV: 'production', STATIC_DIR: path.join(directory, 'dist') }, staticApplicationRoot: directory });
    const response = await fetch(base + '/museum/example');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

});
