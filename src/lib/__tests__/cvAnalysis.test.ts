import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPreAnalyze, runCLAHE } from '../cvAnalysis';

describe('cvAnalysis timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10 }));

    class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({ data: new Uint8Array([0, 0, 0, 0]) })
        };
      }
    }
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(new Blob([])) }));

    class MockWorker {
      postMessage = vi.fn();
      onmessage = null;
      onerror = null;
    }
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should timeout when worker takes too long for PREANALYZE', async () => {
    const promise = runPreAnalyze('http://example.com/dummy.jpg');

    // allow microtasks to flush
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // fast forward 6000ms timeout
    vi.advanceTimersByTime(6100);

    await expect(promise).rejects.toThrow(/Timeout after 6000ms for PREANALYZE/);
  });

  it('should timeout when worker takes too long for CLAHE', async () => {
    // re-enable fake timers because the previous test might have advanced it and we are in a new test execution context,
    // but actually `beforeEach` runs again so we should have fake timers active.

    const promise = runCLAHE('http://example.com/dummy.jpg');

    // allow microtasks to flush
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // fast forward 5000ms timeout
    vi.advanceTimersByTime(5100);

    await expect(promise).rejects.toThrow(/Timeout after 5000ms for CLAHE/);
  });
});
