import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPreAnalyze } from '../../lib/cvAnalysis';
import { artifactService } from '../../services/artifactService';
import { useAppStore } from '../../store/useAppStore';
import type { AnalysisResult } from '../../types';
import { captureArtifactPrincipal, useAnalyzeArtifact, useCompareArtifacts } from '../useArtifacts';

vi.mock('../../services/artifactService', () => ({
  artifactService: { compressAndConvert: vi.fn(), analyze: vi.fn(), compare: vi.fn() },
}));

vi.mock('../../lib/cvAnalysis', () => ({
  runPreAnalyze: vi.fn(),
  pixelsToDataUrl: vi.fn(() => 'data:image/png;base64,example'),
  runCLAHE: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(ok => { resolve = ok; });
  return { promise, resolve };
}

function setup<T>(hook: () => T) {
  const client = new QueryClient();
  return renderHook(hook, {
    wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

const image = 'blob:artifact';
const file = new File([], 'artifact.jpg', { type: 'image/jpeg' });
const compressed = { base64: 'data', mimeType: 'image/jpeg' };
const analysis = { title: 'Sample artifact' } as AnalysisResult;
const comparison = { similarity_score: 80 };
const account = (id: string) => ({ id }) as User;

describe('artifact mutations and authentication changes', () => {
  beforeEach(() => {
    useAppStore.getState().resetApp();
    useAppStore.setState({ user: account('first-account'), authRevision: 1, image });
    vi.resetAllMocks();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL() { return 'blob:comparison'; }
    });
    vi.mocked(artifactService.compressAndConvert).mockResolvedValue(compressed);
    vi.mocked(runPreAnalyze).mockResolvedValue({
      summary: 'sample', overlayPixels: [], regionMapPixels: [], w: 1, h: 1,
      dominantColors: [], edgeCount: 0, contourCount: 0,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('stops queued analysis before writing image data or calling the provider after a session change', async () => {
    const pendingCompression = deferred<typeof compressed>();
    vi.mocked(artifactService.compressAndConvert).mockReturnValue(pendingCompression.promise);
    const { result } = setup(useAnalyzeArtifact);
    let mutation!: Promise<AnalysisResult>;
    act(() => {
      mutation = result.current.mutateAsync({ file, lang: 'en', selection: { ...captureArtifactPrincipal(), image } });
      void mutation.catch(() => {});
    });
    await waitFor(() => expect(artifactService.compressAndConvert).toHaveBeenCalled());

    await act(async () => {
      useAppStore.setState({ authRevision: 3 });
      pendingCompression.resolve(compressed);
      await expect(mutation).rejects.toMatchObject({ name: 'AbortError' });
    });
    expect(useAppStore.getState().imageBase64).toBeNull();
    expect(runPreAnalyze).not.toHaveBeenCalled();
    expect(artifactService.analyze).not.toHaveBeenCalled();
  });

  it('discards an old comparison response and keeps the valid result of the next account', async () => {
    const pendingComparison = deferred<typeof comparison>();
    vi.mocked(artifactService.compare).mockReturnValueOnce(pendingComparison.promise).mockResolvedValue(comparison);
    const { result } = setup(useCompareArtifacts);
    let mutation!: Promise<unknown>;
    act(() => {
      mutation = result.current.mutateAsync({ files: [file, file], principal: captureArtifactPrincipal() });
      void mutation.catch(() => {});
    });
    await waitFor(() => expect(artifactService.compare).toHaveBeenCalledWith(expect.any(Array), expect.any(String), 'first-account'));

    await act(async () => {
      useAppStore.getState().resetApp();
      useAppStore.setState({ user: account('second-account'), authRevision: 2 });
      pendingComparison.resolve(comparison);
      await expect(mutation).rejects.toMatchObject({ name: 'AbortError' });
      expect(useAppStore.getState().compareResult).toBeNull();

      await result.current.mutateAsync({ files: [file, file], principal: captureArtifactPrincipal() });
    });
    expect(artifactService.compare).toHaveBeenLastCalledWith(expect.any(Array), expect.any(String), 'second-account');
    expect(useAppStore.getState().compareResult).toBe(comparison);
  });

  it('discards a completed analysis if the account changed while it was running', async () => {
    const pendingAnalysis = deferred<AnalysisResult>();
    vi.mocked(artifactService.analyze).mockReturnValue(pendingAnalysis.promise);
    const onSuccess = vi.fn();
    const { result } = setup(useAnalyzeArtifact);
    let mutation!: Promise<AnalysisResult>;
    act(() => {
      mutation = result.current.mutateAsync({ file, lang: 'en', selection: { ...captureArtifactPrincipal(), image } }, { onSuccess });
      void mutation.catch(() => {});
    });
    await waitFor(() => expect(artifactService.analyze).toHaveBeenCalled());

    await act(async () => {
      useAppStore.getState().resetApp();
      useAppStore.setState({ user: account('second-account'), authRevision: 2 });
      pendingAnalysis.resolve(analysis);
      await expect(mutation).rejects.toMatchObject({ name: 'AbortError' });
    });
    expect(useAppStore.getState().result).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps successful analysis in the current session and invokes the caller callback', async () => {
    vi.mocked(artifactService.analyze).mockResolvedValue(analysis);
    const onSuccess = vi.fn();
    const { result } = setup(useAnalyzeArtifact);
    await act(async () => {
      await result.current.mutateAsync({ file, lang: 'en', selection: { ...captureArtifactPrincipal(), image } }, { onSuccess });
    });
    expect(artifactService.analyze).toHaveBeenCalledWith(compressed.base64, compressed.mimeType, 'en', 'sample', 'first-account');
    expect(useAppStore.getState().result).toBe(analysis);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
