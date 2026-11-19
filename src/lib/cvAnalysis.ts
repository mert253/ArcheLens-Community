/**
 * CV Analysis library — communicates with cvWorker.ts
 * Provides image-to-pixel helpers and typed worker calls with timeout.
 */

import { useAppStore } from '../store/useAppStore';

let worker: Worker | null = null;
let pendingCallbacks = new Map<string, { resolve: Function; reject: Function }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/cvWorker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      if (e.data.type === 'LOG') {
        useAppStore.getState().addLog(e.data.severity, e.data.msg, e.data.meta);
        return;
      }
      const { id, ok, payload, error } = e.data;
      const cb = pendingCallbacks.get(id);
      if (!cb) return;
      pendingCallbacks.delete(id);
      ok ? cb.resolve(payload) : cb.reject(new Error(error));
    };
    worker.onerror = (e) => {
      console.error('[cvWorker] Worker error:', e.message);
    };
  }
  return worker;
}

function callWorker<T>(type: string, data: object, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingCallbacks.delete(id);
      reject(new Error(`[cvWorker] Timeout after ${timeoutMs}ms for ${type}`));
    }, timeoutMs);

    pendingCallbacks.set(id, {
      resolve: (v: T) => { clearTimeout(timer); resolve(v); },
      reject:  (e: Error) => { clearTimeout(timer); reject(e); },
    });

    getWorker().postMessage({ type, id, ...data });
  });
}

// ─── Image → pixel bytes ───────────────────────────────────────────────────────
/** Load a data URL or blob URL into an ImageData via OffscreenCanvas */
export async function imageUrlToPixels(url: string): Promise<{ pixelsB64: string; w: number; h: number }> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height);
  // Encode RGBA bytes to base64
  const bytes = imgData.data;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const pixelsB64 = btoa(bin);
  return { pixelsB64, w: bmp.width, h: bmp.height };
}

/** Convert raw RGBA pixel array + dimensions to a data URL */
export function pixelsToDataUrl(pixels: number[], w: number, h: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PreAnalyzeResult {
  summary: string;
  overlayPixels: number[];
  regionMapPixels: number[];
  w: number;
  h: number;
  dominantColors: string[];
  edgeCount: number;
  contourCount: number;
}

export interface ClaheResult {
  pixels: number[];
  w: number;
  h: number;
}

/**
 * Run Canny + contours + k-means on the artifact image.
 * Returns a text summary for the LLM and the edge-overlay pixel array.
 * 3-second hard timeout.
 */
export async function runPreAnalyze(imageUrl: string): Promise<PreAnalyzeResult> {
  const { pixelsB64, w, h } = await imageUrlToPixels(imageUrl);
  return callWorker<PreAnalyzeResult>('PREANALYZE', { pixelsB64, w, h }, 6000);
}

/**
 * Apply CLAHE + adaptive threshold to enhance faint inscriptions.
 * Returns processed pixel array.
 * 5-second timeout (CLAHE is slightly heavier).
 */
export async function runCLAHE(imageUrl: string): Promise<ClaheResult> {
  const { pixelsB64, w, h } = await imageUrlToPixels(imageUrl);
  return callWorker<ClaheResult>('CLAHE', { pixelsB64, w, h }, 5000);
}
