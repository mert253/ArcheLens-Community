/**
 * Potsherd Matching Web Worker
 * Pipeline:
 *   1. Load each image → cv.Mat
 *   2. Compute Hu moments (edge shape) + color histogram (texture)
 *   3. Compare all N*(N-1)/2 pairs
 *   4. Score = 0.4 * edgeSim + 0.6 * textureSim
 *
 * Messages in:
 *   { type: 'PROCESS', files: [{ id, name, buffer: ArrayBuffer }] }
 *
 * Messages out:
 *   { type: 'PROGRESS', done: number, total: number }
 *   { type: 'DONE', matches: PotsherdMatch[] }
 *   { type: 'ERROR', message: string }
 */

// @ts-ignore — opencv-js ships its own d.ts
import cv from '@techstark/opencv-js';

interface FileInput {
  id: string;
  name: string;
  buffer: ArrayBuffer;
}

interface ImageFeatures {
  id: string;
  name: string;
  huLog: number[];      // 7 log-transformed Hu moments
  colorHist: Float32Array; // 96 bins (32 × 3 channels), normalized
}

interface MatchResult {
  id: string;
  a: string; b: string;
  nameA: string; nameB: string;
  edgeSim: number;
  textureSim: number;
  score: number;
  marked: boolean;
}

// ─── Image loading ─────────────────────────────────────────────────────────────
async function bufferToMat(buffer: ArrayBuffer): Promise<{ mat: cv.Mat; imgData: ImageData }> {
  const blob = new Blob([buffer]);
  const bmp  = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx  = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return { mat: cv.matFromImageData(imgData), imgData };
}

// ─── Hu moments from edge image ────────────────────────────────────────────────
function computeHuLog(src: cv.Mat): number[] {
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

  const edges = new cv.Mat();
  cv.Canny(blurred, edges, 50, 150);

  const m = cv.moments(edges, false);
  const hu = new cv.Mat();
  cv.HuMoments(m, hu);

  const result: number[] = [];
  for (let i = 0; i < 7; i++) {
    const v = hu.doubleAt(i, 0);
    result.push(v === 0 ? 0 : Math.sign(v) * Math.log10(Math.abs(v)));
  }

  [gray, blurred, edges, hu].forEach(m => { try { m.delete(); } catch {} });
  return result;
}

// ─── Color histogram (manual, no opencv needed for this part) ──────────────────
function computeColorHist(imgData: ImageData, bins = 32): Float32Array {
  const hist = new Float32Array(bins * 3);
  const binSize = 256 / bins;
  const data = imgData.data;
  const total = imgData.width * imgData.height;

  for (let i = 0; i < data.length; i += 4) {
    hist[Math.floor(data[i]     / binSize)]++;               // R
    hist[bins + Math.floor(data[i + 1] / binSize)]++;        // G
    hist[bins * 2 + Math.floor(data[i + 2] / binSize)]++;    // B
  }

  for (let i = 0; i < hist.length; i++) hist[i] /= total;
  return hist;
}

// ─── Similarity metrics ────────────────────────────────────────────────────────
function huSimilarity(h1: number[], h2: number[]): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Math.abs(h1[i] - h2[i]);
  return Math.max(0, Math.min(1, 1 / (1 + sum)));
}

function histCorrelation(h1: Float32Array, h2: Float32Array): number {
  let m1 = 0, m2 = 0;
  for (let i = 0; i < h1.length; i++) { m1 += h1[i]; m2 += h2[i]; }
  m1 /= h1.length; m2 /= h2.length;

  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < h1.length; i++) {
    const a = h1[i] - m1, b = h2[i] - m2;
    num += a * b; d1 += a * a; d2 += b * b;
  }
  const corr = (d1 === 0 || d2 === 0) ? 0 : num / Math.sqrt(d1 * d2);
  return (corr + 1) / 2; // map [-1,1] → [0,1]
}

// ─── Main handler ──────────────────────────────────────────────────────────────
self.onmessage = async (e: MessageEvent) => {
  const { type, files } = e.data as { type: string; files: FileInput[] };
  if (type !== 'PROCESS') return;

  try {
    // 1. Extract features for all images
    const features: ImageFeatures[] = [];
    for (const f of files as FileInput[]) {
      try {
        const { mat, imgData } = await bufferToMat(f.buffer);
        const huLog    = computeHuLog(mat);
        const colorHist = computeColorHist(imgData);
        mat.delete();
        features.push({ id: f.id, name: f.name, huLog, colorHist });
      } catch (err) {
        self.postMessage({
          type: 'LOG',
          severity: 'warn',
          msg: `[potsher] feature extraction failed for ${f.name}`,
          meta: { error: err }
        });
      }
    }

    // 2. Compare all pairs
    const n = features.length;
    const totalPairs = (n * (n - 1)) / 2;
    let done = 0;
    const matches: MatchResult[] = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const fa = features[i];
        const fb = features[j];

        const edgeSim    = huSimilarity(fa.huLog, fb.huLog);
        const textureSim = histCorrelation(fa.colorHist, fb.colorHist);
        const score      = 0.4 * edgeSim + 0.6 * textureSim;

        done++;

        // Only report pairs above 0.5 threshold
        if (score >= 0.5) {
          matches.push({
            id:     `${fa.id}-${fb.id}`,
            a:      fa.id,
            b:      fb.id,
            nameA:  fa.name,
            nameB:  fb.name,
            edgeSim,
            textureSim,
            score,
            marked: false,
          });
        }

        // Progress every 10 pairs
        if (done % 10 === 0 || done === totalPairs) {
          self.postMessage({ type: 'PROGRESS', done, total: totalPairs });
        }
      }
    }

    // 3. Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    self.postMessage({ type: 'DONE', matches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'ERROR', message });
  }
};
