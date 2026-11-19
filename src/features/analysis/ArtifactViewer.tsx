import React, { useRef, useEffect, lazy, Suspense, useState } from 'react';
import { History, Wand2, Box } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { useIsMutating } from '@tanstack/react-query';
import { ImageComparison } from '../../components/ImageComparison';
import { t } from '../../i18n';

const ModelViewer3D = lazy(() =>
  import('./ModelViewer3D').then(m => ({ default: m.ModelViewer3D }))
);

export const ArtifactViewer: React.FC = () => {
  const {
    image, restoredImage, showComparison, result, systemLogs, glbModelUrl
  } = useAppStore();
  const { lang } = useUIStore();
  const [show3D, setShow3D] = useState(false);

  const loading = useIsMutating({ mutationKey: ['analyze'] }) > 0;
  const isRestoring = useIsMutating({ mutationKey: ['restore'] }) > 0;

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [systemLogs]);

  // 3D viewer overlay
  if (show3D && glbModelUrl && result) {
    return (
      <div className="w-full">
        <Suspense fallback={
          <div className="w-full aspect-video bg-stone-900 rounded-2xl flex items-center justify-center">
            <div className="text-stone-400 text-xs animate-pulse">
              {lang === 'tr' ? 'Model yükleniyor...' : 'Loading model...'}
            </div>
          </div>
        }>
          <ModelViewer3D
            glbUrl={glbModelUrl}
            result={result}
            lang={lang}
            onClose={() => setShow3D(false)}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="relative glass-panel rounded-[2.5rem] overflow-hidden shadow-2xl border border-[var(--border-secondary)] group aspect-[4/5] flex items-center justify-center">
      {/* ── Görsel katmanı ── */}
      {restoredImage && showComparison ? (
        // Karşılaştırma modu: sol orijinal, sağ restore
        <ImageComparison
          beforeImage={image!}
          afterImage={restoredImage}
          labelBefore={lang === 'tr' ? 'Orijinal' : 'Original'}
          labelAfter={lang === 'tr' ? 'Restore Edilmiş' : 'Restored'}
        />
      ) : restoredImage ? (
        // Restore görüntüsü (karşılaştırma kapalı)
        <>
          <img
            src={restoredImage}
            alt="Restored Artifact"
            className="absolute inset-0 w-full h-full object-contain p-8 transition-all duration-700 drop-shadow-2xl"
            style={{ filter: 'contrast(1.1) saturate(1.2) brightness(1.05)' }}
          />
          <div className="absolute top-8 left-8">
            <span className="glass-panel text-emerald-400 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-md flex items-center gap-3">
              <Wand2 className="w-3.5 h-3.5" /> {lang === 'tr' ? 'Restore Edilmiş' : 'Restored'}
            </span>
          </div>
        </>
      ) : (
        // Orijinal görsel
        <>
          <img
            src={image!}
            alt="Artifact"
            className="absolute inset-0 w-full h-full object-contain p-8 transition-transform duration-700 drop-shadow-2xl"
          />
          {result?.bounding_boxes && result.bounding_boxes.length > 0 && (
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full p-8 pointer-events-none z-10">
              {result.bounding_boxes.map((box, i) => {
                const [ymin, xmin, ymax, xmax] = box.box_2d;
                return (
                  <g key={i} className="group/box pointer-events-auto cursor-help">
                    <rect x={xmin} y={ymin} width={xmax - xmin} height={ymax - ymin}
                      fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeWidth="4"
                      className="transition-all duration-300 group-hover/box:fill-opacity-30 mix-blend-screen"
                    />
                    <foreignObject x={xmin} y={Math.max(0, ymin - 120)} width="250" height="110"
                      className="opacity-0 group-hover/box:opacity-100 transition-opacity duration-300 pointer-events-none overflow-visible">
                      <div className="bg-stone-900/95 backdrop-blur-xl border border-stone-700 rounded-xl p-3 text-[10px] shadow-2xl text-stone-200 flex flex-col gap-1">
                        <strong className="text-[var(--accent)] font-bold uppercase tracking-widest text-xs">{box.label}</strong>
                        <p className="line-clamp-3 leading-relaxed">{box.description}</p>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          )}
          <div className="absolute top-8 left-8">
            <span className="glass-panel text-[var(--text-primary)] px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-md flex items-center gap-3">
              <History className="w-3.5 h-3.5 text-[var(--accent)]" /> {t('restore.original', lang)}
            </span>
          </div>
        </>
      )}

      {loading && (
        <div className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-xl flex flex-col items-center justify-center z-30 px-10 border border-[var(--border-primary)] m-2 rounded-[2rem]">
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] mb-4">
              <span>{t('log.systemLogs', lang)}</span>
              <span className="animate-pulse flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></div>
                {t('log.live', lang)}
              </span>
            </div>
            <div className="h-48 overflow-hidden font-mono text-xs text-[var(--text-primary)] border-l border-[var(--accent)] pl-4 space-y-2 opacity-80 backdrop-blur-sm bg-[var(--bg-primary)]/30 rounded-r-xl p-4">
              {systemLogs.map((log, i) => (
                <div key={i} className={`animate-fade-in-up flex gap-3 ${log.severity === 'error' ? 'text-red-400' : log.severity === 'warn' ? 'text-yellow-400' : ''}`}>
                  <span className={`${log.severity === 'error' ? 'text-red-500' : log.severity === 'warn' ? 'text-yellow-500' : 'text-[var(--accent)]'} opacity-70`}>[{log.time}]</span>
                  <span className={`${log.severity === 'error' ? 'text-red-300' : log.severity === 'warn' ? 'text-yellow-300' : 'text-[var(--text-secondary)]'} font-medium`}>{log.msg}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none rounded-[2rem] overflow-hidden">
            <div className="scan-line-anim" />
          </div>
        </div>
      )}

      {isRestoring && (
        <div className="absolute inset-0 bg-stone-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white z-30">
          <Wand2 className="w-12 h-12 mb-6 animate-spin-slow text-[var(--accent)]" />
          <span className="text-2xl font-serif italic">{t('restore.restoring', lang)}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)] opacity-70 mt-2">{t('restore.engine', lang)}</span>
          <p className="mt-4 text-xs font-normal text-stone-300 text-center max-w-xs px-4 opacity-80">{t('restore.restoringDesc', lang)}</p>
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
            <div className="scan-line-anim" style={{ animationDuration: '2s', opacity: 0.5 }} />
          </div>
        </div>
      )}

      {/* 3D Model button — shown when GLB is available */}
      {glbModelUrl && !loading && !isRestoring && (
        <button
          onClick={() => setShow3D(true)}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[10px] uppercase tracking-widest px-4 py-2 rounded-full shadow-lg transition-all duration-300"
        >
          <Box className="w-3.5 h-3.5" />
          {lang === 'tr' ? '3D Görüntüle' : 'View 3D'}
        </button>
      )}
    </div>
  );
};
