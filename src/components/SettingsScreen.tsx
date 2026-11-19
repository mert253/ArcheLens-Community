import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Settings, ArrowLeft, Cpu, Download,
  CheckCircle, AlertCircle, Loader2, Wifi, WifiOff, BrainCircuit
} from 'lucide-react';
import { API_BASE } from '../lib/config';
import { useUIStore } from '../store/useUIStore';
import { useWebLLM } from '../hooks/useWebLLM';
import { useAIMode, AIMode } from '../hooks/useAIMode';
import { OFFLINE_MODEL_ID } from '../lib/webllm';

export const SettingsScreen: React.FC<{ onSetupComplete?: () => void }> = ({ onSetupComplete }) => {
  const [status, setStatus] = useState('Checking server…');
  const { setAppMode, lang } = useUIStore();
  const { status: llmStatus, progress: llmProgress, errorMsg: llmError, load: loadModel, unload: unloadModel } = useWebLLM();
  const { aiMode, resolvedAIMode, setAIMode } = useAIMode();
  const tr = lang === 'tr';

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/setup/status`, { signal: controller.signal }).then(r => r.json()).then(s => {
      setStatus(s.configured ? 'Cloud analysis configured' : 'Cloud analysis requires server configuration');
    }).catch(() => { if (!controller.signal.aborted) setStatus('Server unavailable — start npm run dev:all'); });
    return () => controller.abort();
  }, []);

  return (
    <section className="max-w-3xl mx-auto p-8 space-y-6 text-[var(--text-primary)]">
      <div className="flex gap-3 items-center">
        <Settings className="text-[var(--accent)]" />
        <h1 className="font-serif text-3xl">{tr ? 'Ayarlar' : 'Settings'}</h1>
      </div>

      <div className="glass-panel rounded-2xl border border-[var(--border-primary)] p-6 space-y-4">
        <p className="flex gap-2 items-center font-medium"><ShieldCheck className="text-emerald-500" size={20} />{status}</p>
        <p>Provider keys are configured by the server operator in <code>.env.local</code> or a deployment secret store. Restart the server after changing configuration.</p>
        <p>Use a separate Supabase project for this edition. Browser configuration accepts only a public publishable or legacy anon key. Administrative service keys belong in neither the browser nor this application.</p>
        <p className="text-sm text-[var(--text-secondary)]">History is saved to this browser’s IndexedDB and is shared by people using this browser profile. Cloud analysis sends images and prompts to Gemini. Optional photogrammetry sends photos to Polycam. Publish museum content only when you have permission to share it.</p>
      </div>

      {/* ── Offline AI Model ── */}
      <div className="glass-panel rounded-2xl border border-[var(--border-primary)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-sky-400" />
          <h2 className="text-[var(--text-primary)] font-semibold text-sm">
            {tr ? 'Çevrimdışı AI Modeli' : 'Offline AI Model'}
          </h2>
        </div>

        <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
          {tr
            ? 'İnternet bağlantısı olmadan analiz yapabilmek için yerel bir model indirilir. Model tarayıcı önbelleğine kaydedilir (~2.4 GB).'
            : 'Download a local model to analyze artifacts without internet. The model is cached in the browser (~2.4 GB).'}
        </p>

        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span className="font-mono">{OFFLINE_MODEL_ID}</span>
          <span>~2.4 GB</span>
        </div>

        {llmStatus === 'idle' && (
          <button
            onClick={loadModel}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500
              text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
          >
            <Download className="w-4 h-4" />
            {tr ? 'Modeli İndir' : 'Download Model'}
          </button>
        )}

        {llmStatus === 'loading' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sky-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {tr ? 'İndiriliyor...' : 'Downloading...'}
              </span>
              <span className="text-[var(--text-secondary)]">{llmProgress}%</span>
            </div>
            <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-300"
                style={{ width: `${llmProgress}%` }}
              />
            </div>
          </div>
        )}

        {llmStatus === 'ready' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" />
              {tr ? 'Model hazır' : 'Model ready'}
            </div>
            <button
              onClick={unloadModel}
              className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
            >
              {tr ? 'Bellekten kaldır' : 'Unload'}
            </button>
          </div>
        )}

        {llmStatus === 'error' && (
          <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{llmError || (tr ? 'Model yüklenemedi.' : 'Model failed to load.')}</span>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--border-primary)] space-y-3">
          <p className="text-[var(--text-secondary)] text-xs font-semibold">
            {tr ? 'Analiz Modu' : 'Analysis Mode'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'online'  as AIMode, icon: Wifi,    label: tr ? 'Çevrimiçi' : 'Online',    desc: tr ? 'Gemini kullan' : 'Use Gemini' },
              { value: 'offline' as AIMode, icon: WifiOff, label: tr ? 'Çevrimdışı' : 'Offline',  desc: tr ? 'Yerel model' : 'Local model' },
              { value: 'auto'    as AIMode, icon: Cpu,     label: tr ? 'Otomatik' : 'Auto',        desc: tr ? 'Bağlantıya göre' : 'By connection' },
            ]).map(({ value, icon: Icon, label, desc }) => (
              <button
                key={value}
                onClick={() => setAIMode(value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center
                  ${aiMode === value
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-[var(--border-primary)] hover:border-sky-500/50'}`}
              >
                <Icon className={`w-4 h-4 ${aiMode === value ? 'text-sky-400' : 'text-[var(--text-secondary)]'}`} />
                <span className={`text-[11px] font-bold leading-tight ${aiMode === value ? 'text-sky-300' : 'text-[var(--text-primary)]'}`}>
                  {label}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)] leading-tight">{desc}</span>
              </button>
            ))}
          </div>
          {aiMode === 'auto' && (
            <p className="text-xs text-center text-[var(--text-secondary)]">
              {tr ? 'Şu an: ' : 'Currently: '}
              <span className={resolvedAIMode === 'offline' ? 'text-amber-400' : 'text-emerald-400'}>
                {resolvedAIMode === 'offline'
                  ? (tr ? '⚡ Çevrimdışı moda geçildi' : '⚡ Switched to offline')
                  : (tr ? '✓ Çevrimiçi bağlantı var' : '✓ Online connection available')}
              </span>
            </p>
          )}
          {(aiMode === 'offline' || (aiMode === 'auto' && resolvedAIMode === 'offline')) && llmStatus !== 'ready' && (
            <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {tr
                  ? 'Çevrimdışı analiz için modelin indirilmesi gerekiyor.'
                  : 'The model must be downloaded for offline analysis.'}
              </span>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => { onSetupComplete?.(); setAppMode('main'); }} className="rounded-xl px-5 py-3 bg-amber-500 text-stone-950 font-semibold flex items-center gap-2">
        <ArrowLeft size={16} />{tr ? 'Çalışma Alanına Dön' : 'Back to workspace'}
      </button>
    </section>
  );
};
