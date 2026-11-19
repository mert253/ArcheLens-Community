/**
 * CV Web Worker — OpenCV.js operations
 * Handles:
 *   PREANALYZE : Canny edge + contour + k-means color segmentation
 *   CLAHE      : Contrast-Limited Adaptive Histogram Equalization + adaptive threshold
 *
 * Messages in:  { type, id, imageData }   (imageData = base64 PNG/JPEG without prefix)
 * Messages out: { id, ok, payload?, error? }
 */

// @ts-ignore — opencv-js ships its own d.ts
import cv from '@techstark/opencv-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function matToBase64(mat: cv.Mat): string {
  // Encode mat to PNG via OffscreenCanvas
  const canvas = new OffscreenCanvas(mat.cols, mat.rows);
  const ctx = canvas.getContext('2d')!;
  const imgData = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
  ctx.putImageData(imgData, 0, 0);
  // Return as blob → base64
  // We'll use a synchronous trick: draw to canvas, get data URL via canvas.convertToBlob
  // Since we're in a worker, we use ImageData directly
  return canvasToBase64(canvas, mat.cols, mat.rows, mat.data);
}

function canvasToBase64(canvas: OffscreenCanvas, _w: number, _h: number, _data: Uint8Array): string {
  // Write canvas data back as PNG. This is a simplified approach:
  // We encode RGBA data directly as a PNG-like base64 using the canvas API.
  // Note: OffscreenCanvas.convertToBlob is async; we use a sync workaround.
  // Since convertToBlob is async, we instead return the raw RGBA as a flat array
  // and let the main thread reconstruct it.
  return '__raw__'; // Placeholder — actual data returned via rawPixels field
}

function imatToRGBA(mat: cv.Mat): Uint8ClampedArray {
  // Convert cv.Mat (BGR or GRAY) to RGBA Uint8ClampedArray
  let rgba = new cv.Mat();
  if (mat.channels() === 1) {
    cv.cvtColor(mat, rgba, cv.COLOR_GRAY2RGBA);
  } else if (mat.channels() === 3) {
    cv.cvtColor(mat, rgba, cv.COLOR_BGR2RGBA);
  } else {
    mat.copyTo(rgba);
  }
  const result = new Uint8ClampedArray(rgba.data);
  rgba.delete();
  return result;
}

// ─── Load image from base64 into cv.Mat ───────────────────────────────────────
function loadMat(b64: string, w: number, h: number, channels: number): cv.Mat {
  // We receive RGBA pixel data directly from the main thread
  // b64 here is actually raw pixel bytes encoded as base64 (RGBA, 8-bit)
  const bytes = base64ToUint8(b64);
  const mat = cv.matFromArray(h, w, cv.CV_8UC4, Array.from(bytes));
  return mat;
}

// ─── PREANALYZE ───────────────────────────────────────────────────────────────
function preAnalyze(pixelsB64: string, w: number, h: number) {
  const src = loadMat(pixelsB64, w, h, 4);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // 1. Canny edge detection
  const edges = new cv.Mat();
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
  cv.Canny(gray, edges, 50, 150);
  const edgeCount = cv.countNonZero(edges);

  // 2. findContours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const contourCount = contours.size();

  // 3. Canny overlay (red on RGBA copy) + yellow contour bboxes
  const overlay = src.clone();
  const edgesRGBA = new cv.Mat();
  cv.cvtColor(edges, edgesRGBA, cv.COLOR_GRAY2RGBA);
  // Paint edge pixels red
  for (let i = 0; i < edgesRGBA.rows; i++) {
    for (let j = 0; j < edgesRGBA.cols; j++) {
      const pix = edgesRGBA.ucharPtr(i, j);
      if (pix[0] > 128) {
        const op = overlay.ucharPtr(i, j);
        op[0] = 220; op[1] = 30; op[2] = 30; op[3] = 255;
      }
    }
  }

  // Draw yellow bounding boxes for significant contours (> 0.05% of image area)
  const minArea = src.rows * src.cols * 0.0005;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area > minArea) {
      const rect = cv.boundingRect(cnt);
      // Yellow in RGBA: R=255, G=215, B=0, A=255 (gold)
      const yellow = new cv.Scalar(255, 215, 0, 255);
      cv.rectangle(
        overlay,
        new cv.Point(rect.x, rect.y),
        new cv.Point(rect.x + rect.width, rect.y + rect.height),
        yellow,
        2
      );
    }
  }

  // 4. k-means color segmentation (k=5)
  const data = new cv.Mat();
  src.convertTo(data, cv.CV_32F);
  const dataReshaped = data.reshape(1, src.rows * src.cols);
  const labels = new cv.Mat();
  const centers = new cv.Mat();
  const criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 10, 1.0);
  // @ts-ignore — KMEANS_RANDOM_CENTERS not in opencv-js d.ts but available at runtime
  cv.kmeans(dataReshaped, 5, labels, criteria, 3, cv.KMEANS_RANDOM_CENTERS, centers);

  // Extract dominant colors (center values)
  const dominantColors: string[] = [];
  const centerColors: [number, number, number][] = [];
  for (let i = 0; i < centers.rows; i++) {
    const r = Math.round(centers.floatAt(i, 0));
    const g = Math.round(centers.floatAt(i, 1));
    const b = Math.round(centers.floatAt(i, 2));
    dominantColors.push(`rgb(${r},${g},${b})`);
    centerColors.push([r, g, b]);
  }

  // Build k-means region map (each pixel → its cluster center color)
  const regionMap = new cv.Mat(src.rows, src.cols, cv.CV_8UC4);
  const totalPixels = src.rows * src.cols;
  for (let i = 0; i < totalPixels; i++) {
    const label = labels.intAt(i, 0);
    const [r, g, b] = centerColors[label];
    const row = Math.floor(i / src.cols);
    const col = i % src.cols;
    const px = regionMap.ucharPtr(row, col);
    px[0] = r; px[1] = g; px[2] = b; px[3] = 255;
  }
  const regionMapRGBA = new Uint8ClampedArray(regionMap.data);

  // Build overlay RGBA bytes
  const overlayRGBA = imatToRGBA(overlay);

  // Build text summary for LLM
  const summary = `CV Analizi: ${edgeCount} kenar pikseli, ${contourCount} kontur tespiti. Baskın renkler: ${dominantColors.join(', ')}.`;

  // Cleanup
  [src, gray, edges, edgesRGBA, overlay, contours, hierarchy, data, dataReshaped, labels, centers, regionMap].forEach(m => {
    try { m.delete(); } catch {}
  });

  return {
    summary,
    overlayPixels: Array.from(overlayRGBA),
    regionMapPixels: Array.from(regionMapRGBA),
    w, h,
    dominantColors,
    edgeCount,
    contourCount,
  };
}

// ─── CLAHE ────────────────────────────────────────────────────────────────────
function applyCLAHE(pixelsB64: string, w: number, h: number) {
  const src = loadMat(pixelsB64, w, h, 4);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // CLAHE
  const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
  const claheResult = new cv.Mat();
  clahe.apply(gray, claheResult);

  // Adaptive threshold
  const thresh = new cv.Mat();
  cv.adaptiveThreshold(claheResult, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

  // Invert for better visibility on dark bg
  cv.bitwise_not(thresh, thresh);

  // Convert back to RGBA
  const resultRGBA = imatToRGBA(thresh);

  [src, gray, claheResult, thresh].forEach(m => { try { m.delete(); } catch {} });

  return { pixels: Array.from(resultRGBA), w, h };
}

// ─── Message handler ──────────────────────────────────────────────────────────
self.onmessage = (e: MessageEvent) => {
  const { type, id, pixelsB64, w, h } = e.data;

  try {
    if (type === 'PREANALYZE') {
      const result = preAnalyze(pixelsB64, w, h);
      self.postMessage({ id, ok: true, payload: result });
    } else if (type === 'CLAHE') {
      const result = applyCLAHE(pixelsB64, w, h);
      self.postMessage({ id, ok: true, payload: result });
    } else {
      self.postMessage({ id, ok: false, error: `Unknown message type: ${type}` });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, ok: false, error: errorMessage });
  }
};
