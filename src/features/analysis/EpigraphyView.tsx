import React from 'react';
import { Loader2, ScanSearch, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { useEpigraphyAnalyze } from '../../hooks/useArtifacts';
import { useIsMutating } from '@tanstack/react-query';
import { EpigraphyDetection } from '../../types';

/** Confidence → color */
function confidenceColor(c: number) {
  if (c >= 75) return '#22c55e';
  if (c >= 50) return '#f59e0b';
  return '#ef4444';
}

interface BboxOverlayProps {
  detections: EpigraphyDetection[];
  imageUrl: string; // CLAHE-processed or original
}

const BboxOverlay: React.FC<BboxOverlayProps> = ({ detections, imageUrl }) => (
  <div className="relative w-full aspect-square overflow-hidden rounded-2xl bg-stone-900">
    <img src={imageUrl} alt="Epigraphy enhanced" className="absolute inset-0 w-full h-full object-contain" />
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    >
      {detections.map((d, i) => {
        const [ymin, xmin, ymax, xmax] = d.bbox;
        const color = confidenceColor(d.confidence);
        return (
          <g key={i} className="pointer-events-auto">
            <rect
              x={xmin} y={ymin}
              width={xmax - xmin} height={ymax - ymin}
              fill="none" stroke={color} strokeWidth="5"
              strokeDasharray="12 4"
              opacity="0.9"
            />
            {/* Label */}
            <foreignObject
              x={xmin} y={Math.max(0, ymin - 100)}
              width="260" height="90"
              className="overflow-visible"
            >
              <div className="bg-stone-900/95 backdrop-blur border border-stone-700 rounded-xl p-2 text-[10px] shadow-xl">
                <p className="font-bold" style={{ color }}>{d.charSuggestion}</p>
                <p className="text-stone-400">{d.positionLabel}</p>
                <div className="mt-1 h-1 rounded-full bg-stone-700">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${d.confidence}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-stone-400 mt-0.5">%{d.confidence} güven</p>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  </div>
);

export const EpigraphyView: React.FC = () => {
  const { image, epigraphyDetections, epigraphyImage, epigraphyMode, updateState } = useAppStore();
  const { lang } = useUIStore();
  const epigraphyMutation = useEpigraphyAnalyze();
  const isRunning = useIsMutating({ mutationKey: ['epigraphy'] }) > 0;
  const tr = lang === 'tr';

  if (!epigraphyMode) return null;

  const displayImage = epigraphyImage || image || '';
  const hasDetections = epigraphyDetections.length > 0;

  return (
    <div className="mt-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-violet-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
            {tr ? 'Epigrafi Modu' : 'Epigraphy Mode'}
          </h3>
        </div>
        <button
          onClick={() => updateState({ epigraphyMode: false, epigraphyDetections: [], epigraphyImage: null })}
          className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {tr ? 'Kapat' : 'Close'}
        </button>
      </div>

      {/* Scan button */}
      {!isRunning && epigraphyDetections.length === 0 && (
        <button
          onClick={() => epigraphyMutation.mutate()}
          className="w-full h-12 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold
            uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
        >
          <ScanSearch className="w-4 h-4" />
          {tr ? 'Silik İzleri Tara (CLAHE + AI)' : 'Scan for Faint Traces (CLAHE + AI)'}
        </button>
      )}

      {/* Loading */}
      {isRunning && (
        <div className="flex items-center justify-center gap-3 py-6 text-violet-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-semibold">
            {tr ? 'Kontrast artırılıyor ve analiz ediliyor...' : 'Enhancing contrast and analyzing...'}
          </span>
        </div>
      )}

      {/* Error */}
      {epigraphyMutation.isError && (
        <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{(epigraphyMutation.error as Error)?.message || (tr ? 'Tarama başarısız.' : 'Scan failed.')}</span>
        </div>
      )}

      {/* Results */}
      {!isRunning && hasDetections && (
        <>
          <BboxOverlay detections={epigraphyDetections} imageUrl={displayImage} />
          <div className="space-y-2">
            {epigraphyDetections.map((d, i) => (
              <div key={i} className="flex items-start gap-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5">
                <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: confidenceColor(d.confidence) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)]">{d.charSuggestion}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{d.positionLabel}</p>
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] shrink-0">%{d.confidence}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              updateState({ epigraphyDetections: [], epigraphyImage: null });
              epigraphyMutation.mutate();
            }}
            className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1"
          >
            {tr ? 'Yeniden Tara' : 'Re-scan'}
          </button>
        </>
      )}

      {/* No detections */}
      {!isRunning && !hasDetections && epigraphyMutation.isSuccess && (
        <div className="text-center py-4 text-[var(--text-secondary)] text-xs">
          {tr ? 'Silik iz veya yazı tespit edilemedi.' : 'No faint traces or inscriptions detected.'}
        </div>
      )}
    </div>
  );
};
