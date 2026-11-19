import { API_BASE } from './config';
import { getAuthHeaders } from './api';

/** Fetch protected models before passing a local blob URL to Three.js or a link. */
export async function fetchModelBlob(
  modelPath: string,
  { expectedUserId, signal }: { expectedUserId?: string | null; signal?: AbortSignal } = {},
): Promise<Blob> {
  if (!/^\/api\/photogrammetry\/models\/[0-9a-f-]{36}\.glb$/.test(modelPath)) {
    throw new Error('Invalid model path');
  }
  const suffix = modelPath.slice('/api'.length);
  signal?.throwIfAborted();
  const headers = await getAuthHeaders(false, expectedUserId);
  signal?.throwIfAborted();
  const response = await fetch(`${API_BASE}${suffix}`, { headers, signal });
  if (!response.ok) throw new Error('Unable to download this model. Check your session and job expiry.');
  return response.blob();
}
