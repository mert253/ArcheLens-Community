import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIMode } from '../useAIMode';
import { useUIStore } from '../../store/useUIStore';

// Mock fetch
const originalFetch = global.fetch;

describe('useAIMode hook', () => {
  beforeEach(() => {
    // Reset store state
    useUIStore.setState({
      aiMode: 'online',
      resolvedAIMode: 'online',
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('syncs resolvedAIMode to online when aiMode is online', () => {
    useUIStore.setState({ aiMode: 'online' });
    const { result } = renderHook(() => useAIMode());

    expect(result.current.resolvedAIMode).toBe('online');
    expect(result.current.isOffline).toBe(false);
  });

  it('syncs resolvedAIMode to offline when aiMode is offline', () => {
    useUIStore.setState({ aiMode: 'offline' });
    const { result } = renderHook(() => useAIMode());

    expect(result.current.resolvedAIMode).toBe('offline');
    expect(result.current.isOffline).toBe(true);
  });

  it('resolves auto mode to online when server is reachable', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    useUIStore.setState({ aiMode: 'auto' });

    const { result } = renderHook(() => useAIMode());

    // Fast-forward initial check
    await act(async () => {
      // run immediately, so we don't need to advance timers, but we do need to wait for promises
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().resolvedAIMode).toBe('online');
    expect(result.current.resolvedAIMode).toBe('online');
  });

  it('resolves auto mode to offline when server is not reachable', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    useUIStore.setState({ aiMode: 'auto' });

    const { result } = renderHook(() => useAIMode());

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().resolvedAIMode).toBe('offline');
    expect(result.current.resolvedAIMode).toBe('offline');
  });

  it('resolves auto mode to offline when fetch throws an error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    useUIStore.setState({ aiMode: 'auto' });

    const { result } = renderHook(() => useAIMode());

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().resolvedAIMode).toBe('offline');
    expect(result.current.resolvedAIMode).toBe('offline');
  });

  it('polls the server periodically in auto mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    useUIStore.setState({ aiMode: 'auto' });

    renderHook(() => useAIMode());

    // Initial check triggered by useEffect immediately
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time by 15 seconds (CHECK_INTERVAL_MS)
    fetchMock.mockResolvedValue({ ok: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useUIStore.getState().resolvedAIMode).toBe('offline');

    // Advance time by another 15 seconds
    fetchMock.mockResolvedValue({ ok: true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useUIStore.getState().resolvedAIMode).toBe('online');
  });

  it('clears interval on unmount', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    useUIStore.setState({ aiMode: 'auto' });

    const { unmount } = renderHook(() => useAIMode());

    // Initial check
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();

    // Advance time by 15 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    // Fetch should not have been called again (still 1)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
