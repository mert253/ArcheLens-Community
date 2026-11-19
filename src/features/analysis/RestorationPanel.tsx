import React from 'react';
import { Wand2, Layers, Download, Settings2, Sparkles, ScanSearch } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { useRestoreArtifact } from '../../hooks/useArtifacts';
import { useIsMutating } from '@tanstack/react-query';
import { t } from '../../i18n';
import { EvidencePanel } from '../../components/EvidencePanel';
import { EpigraphyView } from './EpigraphyView';

export const RestorationPanel: React.FC = () => {
  const {
    restoredImage, showComparison, restorationMode, customPrompt, result, updateState,
    evidenceRefs, restoreConfidenceScore, hasEvidence,
  } = useAppStore();
  const { lang } = useUIStore();
  const [restorationExplanation, setRestorationExplanation] = React.useState<string | null>(null);

  const isRestoring = useIsMutating({ mutationKey: ['restore'] }) > 0;
  const restoreMutation = useRestoreArtifact();

  const [imageGenerated, setImageGenerated] = React.useState(false);
  // After first run with no evidence, disable button
  const [ranOnce, setRanOnce] = React.useState(false);
  const noEvidenceBlock = ranOnce && !hasEvidence;

  const handleRestore = () => {
    setRestorationExplanation(null);
    setImageGenerated(false);
    restoreMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        if (data.explanation) setRestorationExplanation(data.explanation);
        setImageGenerated(!!data.imageGenerated);
        setRanOnce(true);
        updateState({ showComparison: false });
      },
    });
  };

  const handleDownload = () => {
    if (!restoredImage) return;
    const link = document.createElement('a');
    link.href = restoredImage;
    link.download = `restored_${result?.title?.replace(/\s+/g, '_') || 'artifact'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!result) return null;

  return (
    <div className="mt-6 space-y-4">

      {/* ── Action buttons ── */}
      <div className="flex gap-3">
        {/* Epigraphy mode toggle */}
        <button
          onClick={() => updateState({ epigraphyMode: true })}
          title={lang === 'tr' ? 'Epigrafi Modu — Silik İz Tespiti' : 'Epigraphy Mode — Faint Trace Detection'}
          className="h-14 w-14 shrink-0 glass-panel border border-[var(--border-primary)] rounded-[2rem] flex items-center justify-center
            text-violet-400 hover:text-violet-300 hover:border-violet-400 transition-all"
        >
          <ScanSearch className="w-5 h-5" />
        </button>

        <button
          onClick={handleRestore}
          disabled={isRestoring || noEvidenceBlock}
          title={noEvidenceBlock ? (lang === 'tr' ? 'Yeterli referans bulunamadı — sonuç spekülatif' : 'Insufficient references — result is speculative') : undefined}
          className={`flex-1 h-14 rounded-[2rem] text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-500 shadow-xl
            ${isRestoring || noEvidenceBlock
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed border border-[var(--border-primary)]'
              : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white hover:scale-[1.02] active:scale-95'}`}
        >
          <Wand2 className="w-4 h-4" />
          {isRestoring
            ? (lang === 'tr' ? 'Restore Ediliyor...' : 'Restoring...')
            : restoredImage
              ? t('restore.redo', lang)
              : t('restore.start', lang)}
        </button>

        {restoredImage && imageGenerated && (
          <>
            <button
              onClick={() => updateState({ showComparison: !showComparison })}
              className={`flex-1 h-14 border rounded-[2rem] text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 shadow-md
                ${showComparison
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'glass-panel border-[var(--border-primary)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
            >
              <Layers className="w-4 h-4" />
              {t('restore.compare', lang)}
            </button>

            <button
              onClick={handleDownload}
              title={lang === 'tr' ? 'İndir' : 'Download'}
              className="h-14 w-14 shrink-0 glass-panel border border-[var(--border-primary)] rounded-[2rem] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            >
              <Download className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* ── Mode selector ── */}
      <div className="glass-panel p-5 rounded-[2rem] border border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
            <Settings2 className="w-4 h-4 text-[var(--accent)]" /> {t('restore.mode', lang)}
          </div>
          <div className="flex bg-[var(--bg-tertiary)] p-1 rounded-full border border-[var(--border-primary)]">
            {(['auto', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateState({ restorationMode: mode })}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300
                  ${restorationMode === mode
                    ? 'bg-[var(--bg-secondary)] shadow-sm text-[var(--text-primary)] scale-105'
                    : 'text-[var(--text-tertiary)]'}`}
              >
                {mode === 'auto' ? t('restore.auto', lang) : t('restore.manual', lang)}
              </button>
            ))}
          </div>
        </div>

        {restorationMode === 'auto' ? (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('restore.autoDesc', lang)}</p>
        ) : (
          <div className="space-y-2">
            <textarea
              value={customPrompt}
              onChange={(e) => updateState({ customPrompt: e.target.value })}
              placeholder={t('restore.manualPlaceholder', lang)}
              className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-xl p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] min-h-[80px] resize-none transition-all"
            />
            <p className="text-[10px] text-[var(--text-tertiary)]">{t('restore.manualHint', lang)}</p>
          </div>
        )}
      </div>

      {/* ── Epigraphy mode ── */}
      <EpigraphyView />

      {/* ── Evidence panel (shown after restoration runs) ── */}
      {ranOnce && (
        <EvidencePanel
          evidenceRefs={evidenceRefs}
          confidenceScore={restoreConfidenceScore}
          hasEvidence={hasEvidence}
          lang={lang}
        />
      )}

      {/* ── Fallback uyarısı (görsel üretilemediğinde) ── */}
      {restorationExplanation && !imageGenerated && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
          <span className="text-amber-400 text-lg shrink-0">⚠</span>
          <p className="text-amber-300 text-xs leading-relaxed">
            {lang === 'tr'
              ? 'Imagen görsel üretemedi (kota veya erişim kısıtlaması). Aşağıda uzman restorasyon raporu sunulmuştur.'
              : 'Imagen could not generate an image (quota or access limit). An expert restoration report is shown below.'}
          </p>
        </div>
      )}

      {/* ── AI Restoration explanation ── */}
      {restorationExplanation && (
        <div className="bg-[var(--bg-secondary)] p-6 rounded-[2rem] border border-[var(--border-primary)] shadow-sm animate-fade-in">
          <h4 className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest mb-3">
            {lang === 'tr' ? 'Restorasyon Süreci' : 'Restoration Process'}
          </h4>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-1.5">
            {restorationExplanation.split('\n').filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Digital reconstruction note from analysis ── */}
      {result.digital_reconstruction && result.digital_reconstruction !== 'N/A' && (
        <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-800/30">
          <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {lang === 'tr' ? 'Dijital Rekonstrüksiyon Öngörüsü' : 'Digital Reconstruction Vision'}
          </h4>
          <p className="text-xs text-[var(--text-secondary)] dark:text-stone-300 leading-relaxed italic">
            "{result.digital_reconstruction}"
          </p>
        </div>
      )}
    </div>
  );
};
