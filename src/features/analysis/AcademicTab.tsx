import React from 'react';
import { Calendar, Fingerprint, ScrollText } from 'lucide-react';
import { AnalysisResult, Language } from '../../types';
import { t } from '../../i18n';

interface AcademicTabProps {
  result: AnalysisResult;
  lang: Language;
}

export const AcademicTab: React.FC<AcademicTabProps> = ({ result, lang }) => (
  <div className="space-y-6 animate-fade-in">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AcademicCard title={t('analysis.dateRange', lang)} value={result.dating?.date_range} subtitle={result.dating?.century} icon={<Calendar className="w-3 h-3" />} />
      <AcademicCard title={t('analysis.period', lang)} value={result.dating?.period} />
    </div>
    <Section icon={<Fingerprint className="w-4 h-4" />} title={t('analysis.iconography', lang)}>
      <p className="text-[var(--text-secondary)] dark:text-stone-400 leading-relaxed font-normal">{result.analysis?.iconography}</p>
    </Section>
    {result.analysis?.inscription && (
      <div className="bg-stone-900 text-stone-50 p-10 rounded-[2rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-10 opacity-10"><ScrollText size={180} /></div>
        <div className="flex items-center mb-8 relative z-10 border-b border-stone-700 pb-4">
          <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2"><ScrollText className="w-4 h-4" /> {t('analysis.inscription', lang)}</h4>
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">{t('analysis.originalText', lang)}</span>
            <p className="font-serif text-2xl italic leading-relaxed text-white pl-4 border-l-2 border-stone-500">"{result.analysis.inscription.original}"</p>
          </div>
          {result.analysis.inscription.translation && (
            <div>
              <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">{t('analysis.translation', lang)}</span>
              <p className="text-lg font-normal leading-relaxed text-stone-200">{result.analysis.inscription.translation}</p>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

const Section = ({ icon, title, children }: { icon?: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="bg-[var(--bg-secondary)] p-8 rounded-[2rem] border border-[var(--border-primary)] shadow-sm">
    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2">
      {icon} {title}
    </h4>
    {children}
  </div>
);

const AcademicCard = ({ title, value, subtitle, icon }: { title: string, value?: string, subtitle?: string, icon?: React.ReactNode }) => (
  <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border-primary)] hover:shadow-md transition-shadow">
    <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] block mb-2 flex items-center gap-2">{icon} {title}</span>
    <span className="text-2xl font-serif text-stone-900 block font-medium dark:text-stone-100">{value}</span>
    {subtitle && <span className="text-xs text-[var(--text-tertiary)] mt-1 block">{subtitle}</span>}
  </div>
);
