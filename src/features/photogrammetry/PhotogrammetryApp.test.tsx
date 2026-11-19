import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAuthHeaders } from '../../lib/api';
import { fetchModelBlob } from '../../lib/modelDownload';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import PhotogrammetryApp from './PhotogrammetryApp';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth } }));
vi.mock('../../lib/api', () => ({ getAuthHeaders: vi.fn() }));
vi.mock('../../lib/modelDownload', () => ({ fetchModelBlob: vi.fn() }));

const fetchMock = vi.fn<typeof fetch>();
const createObjectURL = vi.fn((blob: Blob) => blob instanceof File ? `blob:${blob.name}` : 'blob:completed-model');
const revokeObjectURL = vi.fn();
const model = new Blob(['glTF'], { type: 'model/gltf-binary' });
const modelPath = '/api/photogrammetry/models/12345678-1234-1234-1234-123456789abc.glb';
let notifyAuthChange: (event: AuthChangeEvent, session: Session | null) => void;

function session(id: string): Session {
  return { user: { id } } as Session;
}

function switchAccount() {
  act(() => {
    notifyAuthChange('SIGNED_OUT', null);
    notifyAuthChange('SIGNED_IN', session('next-account'));
  });
}

function selectPhotos(container: HTMLElement, count: number) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Photo input is missing');
  const files = Array.from({ length: count }, (_, index) => new File(['sample'], `photo-${index}.jpg`, { type: 'image/jpeg' }));
  fireEvent.change(input, { target: { files } });
}

function jsonResponse(value: unknown): Response {
  return { ok: true, json: async () => value } as Response;
}

async function startModel(container: HTMLElement) {
  fetchMock.mockResolvedValueOnce(jsonResponse({ jobId: 'sample-job' }));
  fetchMock.mockResolvedValueOnce(jsonResponse({ jobId: 'sample-job', status: 'completed', glbUrl: modelPath }));
  selectPhotos(container, 10);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Generate 3D Model' }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.mocked(getAuthHeaders).mockReset().mockResolvedValue({});
  vi.mocked(fetchModelBlob).mockReset().mockResolvedValue(model);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  useUIStore.setState({ lang: 'en' });
  useAppStore.getState().resetApp();
  useAppStore.setState({ session: null, user: null, authLoading: true, authRevision: 0 });
  auth.getSession.mockResolvedValue({ data: { session: session('first-account') } });
  auth.onAuthStateChange.mockImplementation(callback => { notifyAuthChange = callback; });
  useAppStore.getState().initializeAuth();
  notifyAuthChange('SIGNED_IN', session('first-account'));
});

afterEach(() => {
  cleanup();
  useAppStore.getState().resetApp();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('clears selected photos and releases their preview URLs on account change', () => {
  const { container } = render(<PhotogrammetryApp />);
  selectPhotos(container, 1);

  expect(container.querySelector('img')).toHaveAttribute('src', 'blob:photo-0.jpg');
  switchAccount();

  expect(container.querySelector('img')).toBeNull();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-0.jpg');
  expect(screen.getByRole('button', { name: 'Generate 3D Model' })).toBeDisabled();
});

it('clears the completed model link and releases the viewer URL on account change', async () => {
  const { container } = render(<PhotogrammetryApp />);
  await startModel(container);

  expect(screen.getByRole('link', { name: 'GLB' })).toHaveAttribute('href', 'blob:completed-model');
  expect(useAppStore.getState().glbModelUrl).toBe('blob:completed-model');
  switchAccount();

  expect(screen.queryByRole('link', { name: 'GLB' })).not.toBeInTheDocument();
  expect(useAppStore.getState().glbModelUrl).toBeNull();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:completed-model');
});

it('aborts a pending upload on account change without polling a late response', async () => {
  let completeUpload!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise(resolve => { completeUpload = resolve; }));
  const { container } = render(<PhotogrammetryApp />);
  selectPhotos(container, 10);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Generate 3D Model' }));
  });

  const upload = fetchMock.mock.calls[0][1];
  expect(upload?.method).toBe('POST');
  expect(upload?.signal?.aborted).toBe(false);
  switchAccount();
  expect(upload?.signal?.aborted).toBe(true);

  await act(async () => {
    completeUpload(jsonResponse({ jobId: 'sample-job' }));
    await vi.advanceTimersByTimeAsync(5_000);
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(screen.queryByText('Generating 3D Model')).not.toBeInTheDocument();
});

it('aborts a pending model download on account change and ignores a late result', async () => {
  let completeDownload!: (value: Blob) => void;
  vi.mocked(fetchModelBlob).mockReturnValueOnce(new Promise(resolve => { completeDownload = resolve; }));
  const { container } = render(<PhotogrammetryApp />);
  await startModel(container);

  expect(fetchModelBlob).toHaveBeenCalledWith(modelPath, expect.objectContaining({ expectedUserId: 'first-account', signal: expect.any(AbortSignal) }));
  const signal = vi.mocked(fetchModelBlob).mock.calls[0][1]?.signal;
  expect(signal?.aborted).toBe(false);
  switchAccount();
  expect(signal?.aborted).toBe(true);

  await act(async () => { completeDownload(model); });
  expect(createObjectURL).not.toHaveBeenCalledWith(model);
  expect(screen.queryByRole('link', { name: 'GLB' })).not.toBeInTheDocument();
  expect(useAppStore.getState().glbModelUrl).toBeNull();
});

it('retains a completed viewer model when the same account leaves photogrammetry', async () => {
  const { container, unmount } = render(<PhotogrammetryApp />);
  await startModel(container);

  expect(useAppStore.getState().glbModelUrl).toBe('blob:completed-model');
  unmount();
  expect(useAppStore.getState().glbModelUrl).toBe('blob:completed-model');
  expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:completed-model');
});
