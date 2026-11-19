import { useEffect, useRef, useCallback } from 'react';
import { useUIStore, AIMode } from '../store/useUIStore';

import { API_BASE } from '../lib/config';
const HEALTH_URL = `${API_BASE}/health`;
const CHECK_INTERVAL_MS = 15_000; // re-check every 15s in auto mode

async function checkServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Manages AI mode (online / offline / auto).
 * In 'auto' mode it pings the backend every 15s and updates resolvedAIMode.
 */
export function useAIMode() {
  const { aiMode, resolvedAIMode, setAIMode, setResolvedAIMode } = useUIStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    if (useUIStore.getState().aiMode !== 'auto') return;
    const reachable = await checkServerReachable();
    setResolvedAIMode(reachable ? 'online' : 'offline');
  }, [setResolvedAIMode]);

  useEffect(() => {
    // Sync resolvedAIMode with mode when mode changes away from 'auto'
    if (aiMode === 'online') { setResolvedAIMode('online'); return; }
    if (aiMode === 'offline') { setResolvedAIMode('offline'); return; }

    // aiMode === 'auto': run immediately, then poll
    runCheck();
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [aiMode, runCheck, setResolvedAIMode]);

  return {
    aiMode,
    resolvedAIMode,
    setAIMode,
    isOffline: resolvedAIMode === 'offline',
  };
}

export type { AIMode };
