import React, { useState } from 'react';
import { Hexagon, Wand2, Database, Activity, ScanLine } from 'lucide-react';
import { AnalysisResult, Language } from '../../types';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

interface TechnicalTabProps {
  result: AnalysisResult;
  lang: Language;
}

type CvView = 'overlay' | 'regionmap';

export const TechnicalTab: React.FC<TechnicalTabProps> = ({ result, lang }) => {
  const { cvOverlayDataUrl, cvRegionMapDataUrl, cvSummary } = useAppStore();
  const [cvView, setCvView] = useState<CvView>('overlay');
  const hasCv = !!(cvOverlayDataUrl || cvRegionMapDataUrl);
  const tr = lang === 'tr';

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title={t('analysis.techSpecs', lang)}>
        <ul className="space-y-4">
          <TechSpecItem icon={<Hexagon className="w-3 h-3" />} label={t('analysis.material', lang)} value={result.specs?.material} />
          <TechSpecItem icon={<Wand2 className="w-3 h-3" />} label={t('analysis.technique', lang)} value={result.specs?.technique} />
          <TechSpecItem icon={<Database className="w-3 h-3" />} label={t('analysis.dimensions', lang)} value={result.specs?.dimensions} />
        </ul>
      </Section>

      <div className="bg-stone-50 dark:bg-stone-800/50 p-8 rounded-[2rem]">
        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> {t('analysis.condition', lang)}</h4>
        <span className="inline-block px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-3 bg-stone-200 dark:bg-stone-700 text-[var(--text-secondary)] dark:text-stone-300">{result.preservation?.condition}</span>
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{result.preservation?.damages}</p>
      </div>

      {/* ── CV Analysis Layer ── */}
      {hasCv && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[2rem] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-[var(--accent)]" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                {tr ? 'CV Ön Analiz Katmanı' : 'CV Pre-Analysis Layer'}
              </h4>
            </div>
            {/* Toggle: overlay / region map */}
            <div className="flex bg-[var(--bg-tertiary)] p-0.5 rounded-full border border-[var(--border-primary)]">
              {([
                { key: 'overlay',   label: tr ? 'Kenar/Kontur' : 'Edge/Contour' },
                { key: 'regionmap', label: tr ? 'Renk Haritası' : 'Color Map' },
              ] as { key: CvView; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCvView(key)}
                  disabled={key === 'regionmap' && !cvRegionMapDataUrl}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-200
                    ${cvView === key
                      ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-tertiary)] disabled:opacity-40'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="relative bg-stone-950">
            <img
              src={cvView === 'overlay' ? (cvOverlayDataUrl ?? '') : (cvRegionMapDataUrl ?? '')}
              alt={cvView === 'overlay' ? 'CV Overlay' : 'Region Map'}
              className="w-full object-contain max-h-72"
            />
            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <span className="flex items-center gap-1 bg-stone-900/80 backdrop-blur text-[10px] px-2 py-1 rounded-lg text-red-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {tr ? 'Canny kenar' : 'Canny edge'}
              </span>
              <span className="flex items-center gap-1 bg-stone-900/80 backdrop-blur text-[10px] px-2 py-1 rounded-lg text-yellow-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> {tr ? 'Kontur bbox' : 'Contour bbox'}
              </span>
            </div>
          </div>

          {/* Summary text */}
          {cvSummary && (
            <p className="text-[11px] text-[var(--text-secondary)] px-6 py-3 leading-relaxed font-mono border-t border-[var(--border-primary)]">
              {cvSummary}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-[var(--bg-secondary)] p-8 rounded-[2rem] border border-[var(--border-primary)] shadow-sm">
    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">{title}</h4>
    {children}
  </div>
);

const TechSpecItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string }) => (
  <li className="flex justify-between items-center border-b border-stone-50 dark:border-stone-800 pb-3">
    <span className="text-sm text-[var(--text-tertiary)] flex items-center gap-2">{icon} {label}</span>
    <span className="font-medium text-stone-900 dark:text-stone-100">{value}</span>
  </li>
);
