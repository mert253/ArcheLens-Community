import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Dexie, { type EntityTable } from 'dexie';
import { HistoryEntry, AnalysisResult } from '../types';
import { createThumbnail } from '../lib/thumbnail';
import { useAppStore } from '../store/useAppStore';

// ─── Dexie (web / non-Electron fallback) ─────────────────────────────────────
const dexieDb = new Dexie('ArcheLensOpenSourceDB') as Dexie & {
  analyses: EntityTable<HistoryEntry, 'id'>;
};
dexieDb.version(1).stores({ analyses: 'id, timestamp' });

// ─── Dexie (web) hook ─────────────────────────────────────────────────────────
function useDexieHistory() {
  const queryResult = useLiveQuery(() =>
    dexieDb.analyses.orderBy('timestamp').reverse().toArray()
  );
  const entries = queryResult || [];
  const isLoading = queryResult === undefined;

  const addEntry = useCallback(async (
    imageDataUrl: string,
    result: AnalysisResult,
    restoredImageUrl?: string,
    canSave: () => boolean = () => true,
  ) => {
    if (!canSave()) return;
    let thumbnailUrl = imageDataUrl;
    try {
      thumbnailUrl = await createThumbnail(imageDataUrl, 200);
    } catch (err) {
      console.warn('Failed to create thumbnail:', err instanceof Error ? err.message : String(err));
    }
    try {
      await dexieDb.transaction('rw', dexieDb.analyses, async () => {
        if (!canSave()) return;
        await dexieDb.analyses.add({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          imageDataUrl: thumbnailUrl,
          result,
          restoredImageUrl,
        });
      });
    } catch (err) {
      if (!canSave()) return;
      console.error('[Dexie] Save failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      useAppStore.getState().addLog('error', '[Dexie] Save failed', { error: errorMessage });
      throw err;
    }
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    try {
      await dexieDb.analyses.delete(id);
    } catch (err) {
      console.error('[Dexie] Delete failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      useAppStore.getState().addLog('warn', '[Dexie] Delete failed', { error: errorMessage });
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await dexieDb.analyses.clear();
    } catch (err) {
      console.error('[Dexie] Clear failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      useAppStore.getState().addLog('warn', '[Dexie] Clear failed', { error: errorMessage });
    }
  }, []);

  return { entries, isLoading, addEntry, removeEntry, clearAll, refresh: async () => {} };
}

export function useHistory() {
  return useDexieHistory();
}
