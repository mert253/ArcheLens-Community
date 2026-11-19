import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./api', () => ({ getAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer example-invalid-token' })) }));
import { getAuthHeaders } from './api';
import { fetchModelBlob } from './modelDownload';

afterEach(() => vi.unstubAllGlobals());
it('fetches protected models with the current session before viewing', async () => {
  const blob = new Blob(['glTF'], { type: 'model/gltf-binary' });
  const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => blob }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchModelBlob('/api/photogrammetry/models/12345678-1234-1234-1234-123456789abc.glb')).toBe(blob);
  expect(fetchMock).toHaveBeenCalledWith('/api/photogrammetry/models/12345678-1234-1234-1234-123456789abc.glb', expect.objectContaining({ headers: { Authorization: 'Bearer example-invalid-token' } }));
});
it('uses the initiating account and cancels a request during credential lookup', async () => {
  const controller = new AbortController();
  const headers = { Authorization: 'Bearer example-invalid-token' };
  const getHeaders = vi.mocked(getAuthHeaders);
  getHeaders.mockImplementationOnce(async () => {
    controller.abort();
    return headers;
  });
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  await expect(fetchModelBlob('/api/photogrammetry/models/12345678-1234-1234-1234-123456789abc.glb', {
    expectedUserId: 'account-a',
    signal: controller.signal,
  })).rejects.toMatchObject({ name: 'AbortError' });
  expect(getHeaders).toHaveBeenLastCalledWith(false, 'account-a');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('rejects external and traversing model destinations before any network call', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  await expect(fetchModelBlob('https://example.invalid/model.glb')).rejects.toThrow('Invalid model path');
  await expect(fetchModelBlob('/api/photogrammetry/models/../private.glb')).rejects.toThrow('Invalid model path');
  expect(fetchMock).not.toHaveBeenCalled();
});
