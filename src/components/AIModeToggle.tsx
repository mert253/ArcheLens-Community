import React from 'react';
import { Wifi, WifiOff, Cpu } from 'lucide-react';
import { useAIMode, AIMode } from '../hooks/useAIMode';
import { useUIStore } from '../store/useUIStore';
import { useWebLLM } from '../hooks/useWebLLM';

const CYCLE: AIMode[] = ['online', 'offline', 'auto'];

/**
 * Compact badge shown in the analysis toolbar.
 * Click cycles through online → offline → auto.
 */
export const AIModeToggle: React.FC = () => {
  const { aiMode, resolvedAIMode, setAIMode } = useAIMode();
  const { lang } = useUIStore();
  const { status: llmStatus } = useWebLLM();
  const tr = lang === 'tr';

  const cycle = () => {
    const idx = CYCLE.indexOf(aiMode);
    setAIMode(CYCLE[(idx + 1) % CYCLE.length]);
  };

  // Badge appearance
  const isOfflineResolved = resolvedAIMode === 'offline';
  const isAuto = aiMode === 'auto';

  const badgeClass = isOfflineResolved
    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';

  const Icon = isAuto
    ? Cpu
    : isOfflineResolved
    ? WifiOff
    : Wifi;

  const label = (() => {
    if (aiMode === 'online') return tr ? 'Çevrimiçi' : 'Online';
    if (aiMode === 'offline') return tr ? 'Çevrimdışı' : 'Offline';
    // auto
    return isOfflineResolved
      ? (tr ? 'Otomatik · Çevrimdışı' : 'Auto · Offline')
      : (tr ? 'Otomatik · Çevrimiçi'  : 'Auto · Online');
  })();

  // Show a small dot if offline model is not ready when in offline mode
  const showWarning = isOfflineResolved && llmStatus !== 'ready';

  return (
    <button
      onClick={cycle}
      title={tr
        ? 'AI modunu değiştirmek için tıkla (Çevrimiçi → Çevrimdışı → Otomatik)'
        : 'Click to cycle AI mode (Online → Offline → Auto)'}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold
        transition-all hover:opacity-80 select-none ${badgeClass}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{label}</span>
      {showWarning && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
          title={tr ? 'Model henüz yüklü değil' : 'Model not loaded yet'}
        />
      )}
    </button>
  );
};
