/**
 * ArcheLens Open Source — WebLLM Offline AI Engine
 * Uses @mlc-ai/web-llm (Phi-3-mini) running entirely in the browser/Electron renderer.
 * No network required after the model is cached (≈2.4 GB in Chromium Cache Storage).
 */
import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { AnalysisResult, Language } from '../types';

// ─── Model config ─────────────────────────────────────────────────────────────
export const OFFLINE_MODEL_ID = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
// 1k context variant is smaller (~700MB less VRAM); use if GPU budget is tight.
// export const OFFLINE_MODEL_ID = 'Phi-3-mini-4k-instruct-q4f16_1-MLC-1k';

// ─── Status types ─────────────────────────────────────────────────────────────
export type WebLLMStatus = 'idle' | 'loading' | 'ready' | 'error';

// ─── Module-level singleton ───────────────────────────────────────────────────
let engine: MLCEngine | null = null;
let engineLoading = false;
let _status: WebLLMStatus = 'idle';
let _progress = 0; // 0-100
let _errorMsg = '';
type Listener = (status: WebLLMStatus, progress: number, errorMsg: string) => void;
let _listeners: Listener[] = [];

function notify() {
  _listeners.forEach((fn) => fn(_status, _progress, _errorMsg));
}

/** Subscribe to WebLLM status changes. Returns an unsubscribe function. */
export function subscribeWebLLM(fn: Listener): () => void {
  _listeners = [..._listeners, fn];
  fn(_status, _progress, _errorMsg); // immediate snapshot
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

export function getWebLLMStatus(): WebLLMStatus { return _status; }
export function getWebLLMProgress(): number { return _progress; }

// ─── Load / Unload ────────────────────────────────────────────────────────────
/**
 * Downloads (if not cached) and initializes the local Phi-3-mini engine.
 * Progress is broadcast to all subscribers.
 */
export async function loadWebLLM(): Promise<void> {
  if (_status === 'ready') return;
  if (engineLoading) return;

  engineLoading = true;
  _status = 'loading';
  _progress = 0;
  _errorMsg = '';
  notify();

  try {
    engine = await CreateMLCEngine(OFFLINE_MODEL_ID, {
      initProgressCallback: (report: InitProgressReport) => {
        _progress = Math.min(99, Math.round(report.progress * 100));
        notify();
      },
    });
    _status = 'ready';
    _progress = 100;
    notify();
  } catch (err: unknown) {
    _status = 'error';
    _errorMsg = err instanceof Error ? err.message : 'WebLLM yüklenemedi';
    engine = null;
    notify();
    throw err;
  } finally {
    engineLoading = false;
  }
}

export function unloadWebLLM(): void {
  engine?.unload();
  engine = null;
  engineLoading = false;
  _status = 'idle';
  _progress = 0;
  _errorMsg = '';
  notify();
}

// ─── Offline Analysis ─────────────────────────────────────────────────────────
// Phi-3-mini is a text-only model — it cannot process image pixels directly.
// We ask it to produce a structured archaeological analysis using its training knowledge.
// Users see a clear "Çevrimdışı mod" label so they know accuracy is limited.

const SYSTEM_TR = `Sen uzman bir arkeolog ve müze küratörüsün. Sana bir arkeolojik eser hakkında analiz yapman isteniyor.
Görseli gerçek anlamda göremiyorsun, ancak genel arkeolojik bilginle makul ve tutarlı bir analiz üretmelisin.
SADECE aşağıdaki JSON yapısında yanıt ver, hiçbir ek açıklama veya markdown yazma:

{"title":"","confidence_score":0.5,"origin":{"region":"","culture":""},"dating":{"period":"","date_range":"","century":""},"specs":{"style":"","material":"","technique":"","dimensions":"Bilinmiyor"},"analysis":{"description":"","iconography":"","inscription":null},"preservation":{"condition":"","damages":""},"fun_fact":"","curator_note":""}`;

const SYSTEM_EN = `You are an expert archaeologist and museum curator. You are asked to analyze an archaeological artifact.
You cannot truly see the image, but you should produce a reasonable and coherent analysis using your archaeological knowledge.
Respond ONLY with the JSON structure below, no extra text or markdown:

{"title":"","confidence_score":0.5,"origin":{"region":"","culture":""},"dating":{"period":"","date_range":"","century":""},"specs":{"style":"","material":"","technique":"","dimensions":"Unknown"},"analysis":{"description":"","iconography":"","inscription":null},"preservation":{"condition":"","damages":""},"fun_fact":"","curator_note":""}`;

const USER_TR = 'Genel antik Akdeniz / Anadolu arkeoloji bilginle tipik bir arkeolojik eser analizi üret. Tüm alanları doldur.';
const USER_EN = 'Generate a typical archaeological artifact analysis using your general knowledge of ancient Mediterranean / Anatolian archaeology. Fill in all fields.';

export async function analyzeWithWebLLM(
  _imageBase64: string,
  _mimeType: string,
  lang: Language,
): Promise<AnalysisResult> {
  if (!engine || _status !== 'ready') {
    throw new Error(
      lang === 'tr'
        ? 'Çevrimdışı model yüklü değil. Ayarlar ekranından modeli indirin.'
        : 'Offline model is not loaded. Download it from the Settings screen.'
    );
  }

  const tr = lang === 'tr';

  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: tr ? SYSTEM_TR : SYSTEM_EN },
      { role: 'user',   content: tr ? USER_TR   : USER_EN   },
    ],
    temperature: 0.8,
    max_tokens: 1024,
    stream: false,
  });

  const text = reply.choices[0]?.message?.content ?? '';

  // Extract the first {...} block from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      tr ? 'Model geçerli bir JSON yanıtı üretemedi.' : 'Model failed to produce valid JSON.'
    );
  }

  const result = JSON.parse(jsonMatch[0]) as AnalysisResult;

  // Stamp as offline so users know
  result.curator_note = (result.curator_note || '') +
    (tr
      ? ' ⚡ Çevrimdışı mod — görsel analiz yapılamadı, genel bilgiye dayalı tahmini sonuç.'
      : ' ⚡ Offline mode — image analysis unavailable, result based on general knowledge.');

  return result;
}
