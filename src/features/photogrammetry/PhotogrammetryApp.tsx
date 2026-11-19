import { getAuthHeaders } from '../../lib/api';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchModelBlob } from '../../lib/modelDownload';
import {
  Camera, Upload, CheckCircle, AlertCircle,
  Box, ArrowLeft, RefreshCcw, Download, Trash2,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useAppStore } from '../../store/useAppStore';

import { API_BASE } from '../../lib/config';
const MAX_IMAGES = 50;
const MIN_IMAGES = 10;
const POLL_INTERVAL_MS = 5000;

type Step = 'upload' | 'processing' | 'done' | 'error';

interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  glbUrl?: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ step, tr }: { step: Step; tr: boolean }) {
  const steps = [
    { key: 'upload',     label: tr ? 'Fotoğraf Yükle' : 'Upload Photos' },
    { key: 'processing', label: tr ? 'İşleniyor'      : 'Processing'    },
    { key: 'done',       label: tr ? 'Hazır'           : 'Done'          },
  ];
  const idx = step === 'error' ? 1 : steps.findIndex(s => s.key === step);

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all
              ${i < idx  ? 'bg-amber-500 border-amber-500 text-stone-950' :
                i === idx ? 'border-amber-500 text-amber-400 bg-amber-500/10' :
                            'border-stone-600 text-stone-500'}`}>
              {i < idx ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider
              ${i <= idx ? 'text-amber-400' : 'text-stone-500'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-3 mb-5 transition-all ${i < idx ? 'bg-amber-500' : 'bg-stone-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Image thumbnail grid ─────────────────────────────────────────────────────
function ImageGrid({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  const [previews, setPreviews] = useState<{ files: File[]; urls: string[] }>();
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews({ files, urls });
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-4 max-h-56 overflow-y-auto">
      {files.map((_, i) => (
        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-stone-800">
          {previews?.files === files && (
            <img src={previews.urls[i]} alt="" className="w-full h-full object-cover" />
          )}
          <button
            onClick={() => onRemove(i)}
            className="absolute inset-0 bg-red-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PhotogrammetryApp() {
  const authRevision = useAppStore(state => state.authRevision);
  return <PhotogrammetrySession key={authRevision} authRevision={authRevision} />;
}

function PhotogrammetrySession({ authRevision }: { authRevision: number }) {
  const { setAppMode, lang } = useUIStore();
  const tr = lang === 'tr';

  const [files, setFiles]   = useState<File[]>([]);
  const [step, setStep]     = useState<Step>('upload');
  const [job, setJob]       = useState<JobStatus | null>(null);
  const [error, setError]   = useState('');
  const [drag, setDrag]     = useState(false);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const pollRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef          = useRef<AbortController | null>(null);
  const stopWork = useCallback(() => {
    if (pollRef.current !== null) clearTimeout(pollRef.current);
    pollRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  useLayoutEffect(() => {
    const unsubscribe = useAppStore.subscribe(state => {
      if (state.authRevision !== authRevision) stopWork();
    });
    return () => {
      unsubscribe();
      stopWork();
    };
  }, [authRevision, stopWork]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const imgs = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...imgs].slice(0, MAX_IMAGES));
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    const current = useAppStore.getState();
    if (current.authRevision !== authRevision || requestRef.current) return;
    if (files.length < MIN_IMAGES) {
      setError(tr ? `En az ${MIN_IMAGES} fotoğraf gereklidir.` : `At least ${MIN_IMAGES} photos required.`);
      return;
    }
    const expectedUserId = current.user?.id ?? null;
    const controller = new AbortController();
    requestRef.current = controller;
    const { signal } = controller;
    function isCurrent() {
      const { authRevision: revision, user } = useAppStore.getState();
      return !signal.aborted && requestRef.current === controller &&
        revision === authRevision && (user?.id ?? null) === expectedUserId;
    }

    async function request(path: string, init?: RequestInit) {
      const headers = await getAuthHeaders(false, expectedUserId);
      if (!isCurrent()) return;
      return fetch(`${API_BASE}${path}`, { ...init, headers, signal });
    }

    function showError(message: string) {
      if (!isCurrent()) return;
      stopWork();
      setStep('error');
      setError(message);
    }

    function schedulePoll(jobId: string) {
      pollRef.current = setTimeout(() => {
        pollRef.current = null;
        void poll(jobId);
      }, POLL_INTERVAL_MS);
    }

    async function poll(jobId: string) {
      if (!isCurrent()) return;
      try {
        const response = await request(`/photogrammetry/${encodeURIComponent(jobId)}`);
        if (!response || !isCurrent()) return;
        if (!response.ok) {
          schedulePoll(jobId);
          return;
        }
        const data: JobStatus = await response.json();
        if (!isCurrent()) return;
        if (data.status === 'completed') {
          if (data.glbUrl) {
            const blob = await fetchModelBlob(data.glbUrl, { expectedUserId, signal });
            if (!isCurrent()) return;
            const url = URL.createObjectURL(blob);
            useAppStore.getState().setGlbModelUrl(url);
            setJob({ ...data, glbUrl: url });
          } else {
            setJob(data);
          }
          requestRef.current = null;
          setStep('done');
        } else if (data.status === 'failed') {
          showError(data.message || (tr ? 'İşlem başarısız.' : 'Processing failed.'));
        } else {
          setJob(data);
          schedulePoll(jobId);
        }
      } catch (cause) {
        showError(cause instanceof Error ? cause.message : 'Model request failed.');
      }
    }

    setError('');
    setStep('processing');

    const formData = new FormData();
    files.forEach((f, i) => formData.append(`image_${i}`, f));

    try {
      const response = await request('/photogrammetry', { method: 'POST', body: formData });
      if (!response || !isCurrent()) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showError(data.error || (tr ? 'Sunucu hatası.' : 'Server error.'));
        return;
      }
      const data = await response.json();
      if (!isCurrent()) return;
      setJob({ jobId: data.jobId, status: 'queued', progress: 0 });
      schedulePoll(data.jobId);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    stopWork();
    setFiles([]); setStep('upload'); setJob(null); setError('');
  };

  return (
    <div className="min-h-[60vh] max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setAppMode('main')}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors">
          <ArrowLeft size={16} /> {tr ? 'Geri Dön' : 'Go Back'}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Camera className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              {tr ? 'Fotogrametri ile 3D Model' : '3D Model from Photogrammetry'}
            </h1>
            <p className="text-[var(--text-secondary)] text-xs">
              {tr ? '10–50 fotoğraf yükleyerek 3D model üret' : 'Upload 10–50 photos to generate a 3D model'}
            </p>
          </div>
        </div>
      </div>

      <StepBar step={step} tr={tr} />

      {/* ─── UPLOAD STEP ─── */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all
              ${drag
                ? 'border-amber-500 bg-amber-500/5'
                : 'border-[var(--border-primary)] hover:border-amber-500/60 hover:bg-[var(--bg-secondary)]'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />
            <Upload className="w-10 h-10 text-amber-400/60 mx-auto mb-3" />
            <p className="text-[var(--text-primary)] font-semibold text-sm">
              {drag
                ? (tr ? 'Fotoğrafları bırakın...' : 'Drop photos here...')
                : (tr ? 'Fotoğrafları sürükleyin veya tıklayın' : 'Drag & drop photos or click to select')}
            </p>
            <p className="text-[var(--text-secondary)] text-xs mt-1">
              {tr ? `JPEG, PNG, WebP • En az ${MIN_IMAGES}, en fazla ${MAX_IMAGES} fotoğraf`
                  : `JPEG, PNG, WebP • ${MIN_IMAGES}–${MAX_IMAGES} photos`}
            </p>
          </div>

          {files.length > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>
                  <span className="text-amber-400 font-bold">{files.length}</span>
                  {tr ? ' fotoğraf seçildi' : ' photos selected'}
                  {files.length >= MAX_IMAGES && (
                    <span className="text-amber-400 ml-2">({tr ? 'maksimum' : 'max'})</span>
                  )}
                </span>
                <button onClick={() => setFiles([])}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                  <Trash2 className="w-3 h-3" /> {tr ? 'Tümünü Sil' : 'Clear All'}
                </button>
              </div>
              <ImageGrid files={files} onRemove={i => setFiles(prev => prev.filter((_, idx) => idx !== i))} />
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={files.length < MIN_IMAGES}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400
              disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed
              text-stone-950 font-bold rounded-2xl px-6 py-3 text-sm transition-all shadow-lg"
          >
            <Camera className="w-4 h-4" />
            {tr ? '3D Model Oluştur' : 'Generate 3D Model'}
          </button>

          {/* Tips */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              {tr ? 'İpuçları' : 'Tips for best results'}
            </p>
            <ul className="text-[var(--text-secondary)] text-xs space-y-1 list-disc list-inside">
              {(tr ? [
                'Eseri 360° etrafında, sabit mesafeden çekin',
                'İyi aydınlatma kullanın — gölgelerden kaçının',
                'Her fotoğraf öncekiyle %60–80 örtüşmeli',
                'En az 20 fotoğraf en iyi sonucu verir',
              ] : [
                'Shoot the artifact 360° at a consistent distance',
                'Use even lighting — avoid harsh shadows',
                'Each photo should overlap 60–80% with the previous',
                'At least 20 photos gives the best results',
              ]).map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* ─── PROCESSING STEP ─── */}
      {step === 'processing' && (
        <div className="text-center py-16 space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-amber-500 animate-spin" />
            <Camera className="absolute inset-0 m-auto w-8 h-8 text-amber-400" />
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-bold text-lg">
              {tr ? '3D Model Oluşturuluyor' : 'Generating 3D Model'}
            </p>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {job?.message || (tr ? 'Polycam fotoğrafları işliyor...' : 'Polycam is processing your photos...')}
            </p>
          </div>
          {job?.progress !== undefined && job.progress > 0 && (
            <div className="max-w-sm mx-auto space-y-2">
              <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>{tr ? 'İlerleme' : 'Progress'}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}
          <p className="text-[var(--text-secondary)] text-xs">
            {tr ? 'Bu işlem birkaç dakika sürebilir. Sayfayı kapatmayın.'
                : 'This may take a few minutes. Do not close the page.'}
          </p>
        </div>
      )}

      {/* ─── DONE STEP ─── */}
      {step === 'done' && (
        <div className="text-center py-12 space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-bold text-lg">
              {tr ? '3D Model Hazır!' : '3D Model Ready!'}
            </p>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {tr ? 'Model başarıyla oluşturuldu. Görüntüleyici\'de açabilirsiniz.'
                  : 'Model generated successfully. You can open it in the 3D viewer.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setAppMode('main')}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-2xl px-6 py-3 text-sm transition-all shadow-lg"
            >
              <Box className="w-4 h-4" />
              {tr ? '3D Görüntüleyicide Aç' : 'Open in 3D Viewer'}
            </button>
            {job?.glbUrl && (
              <a href={job.glbUrl} download="model.glb"
                className="flex items-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] font-semibold rounded-2xl px-6 py-3 text-sm transition-all">
                <Download className="w-4 h-4" /> GLB
              </a>
            )}
          </div>
          <button onClick={reset}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm flex items-center gap-1.5 mx-auto transition-colors">
            <RefreshCcw className="w-3.5 h-3.5" />
            {tr ? 'Yeni Model Oluştur' : 'Generate Another'}
          </button>
        </div>
      )}

      {/* ─── ERROR STEP ─── */}
      {step === 'error' && (
        <div className="text-center py-12 space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-bold text-lg">
              {tr ? 'İşlem Başarısız' : 'Processing Failed'}
            </p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
          <button onClick={reset}
            className="flex items-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] font-semibold rounded-2xl px-6 py-3 text-sm transition-all mx-auto">
            <RefreshCcw className="w-4 h-4" /> {tr ? 'Tekrar Dene' : 'Try Again'}
          </button>
        </div>
      )}
    </div>
  );
}
