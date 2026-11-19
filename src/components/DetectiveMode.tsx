import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { useIsMutating, useMutationState } from '@tanstack/react-query';
import { Scale, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Microscope, AlignLeft } from 'lucide-react';
import { t } from '../i18n';

export const DetectiveMode: React.FC = () => {
    const { compareResult, compareImages } = useAppStore();
    const { lang } = useUIStore();
    const isTr = lang === 'tr';

    const loading = useIsMutating({ mutationKey: ['compare'] }) > 0;
    const parseErrors = useMutationState({
        filters: { mutationKey: ['compare'], status: 'error' },
        select: (mutation) => (mutation.state.error as Error)?.message
    });
    const error = parseErrors.length > 0 ? parseErrors[parseErrors.length - 1] : null;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in text-center px-4">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-[var(--accent)] rounded-full blur-[60px] opacity-20 animate-pulse-slow"></div>
                    <div className="w-24 h-24 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-primary)] rounded-full flex items-center justify-center shadow-2xl animate-float">
                        <Scale className="w-10 h-10 text-[var(--accent)] animate-pulse" />
                    </div>
                </div>
                <h2 className="text-2xl font-serif text-[var(--text-primary)] mb-4 tracking-wide">
                    {isTr ? 'Ajan Analiz Ediyor...' : 'Detective Analyzing...'}
                </h2>
                <p className="text-[var(--text-secondary)] font-light text-sm max-w-sm uppercase tracking-widest">
                    {isTr ? 'Görseller çapraz eşleştiriliyor, stil ve dönem detayları inceleniyor.' : 'Cross-matching images, investigating style and era details.'}
                </p>
                <div className="w-64 h-1 bg-[var(--bg-secondary)] rounded-full mt-8 overflow-hidden">
                    <div className="h-full bg-[var(--accent)] animate-progress rounded-full"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-[2rem] border border-red-200 dark:border-red-800 animate-fade-in text-center max-w-2xl mx-auto">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
            </div>
        );
    }

    if (!compareResult || compareImages.length !== 2) return null;

    const { similarity_score, conclusion, differences, similarities, era_match, authenticity_analysis, style_differences } = compareResult;

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
            <h2 className="text-4xl md:text-5xl font-serif text-center text-[var(--text-primary)] mb-12 tracking-tight flex items-center justify-center gap-4">
                <Scale className="text-[var(--accent)]" />
                {isTr ? 'Ekspertiz Raporu' : 'Expertise Report'}
            </h2>

            {/* Images Side by Side */}
            <div className="grid grid-cols-2 gap-4 md:gap-8">
                {compareImages.map((img, i) => (
                    <div key={i} className="glass-panel border border-[var(--border-secondary)] rounded-[2rem] overflow-hidden aspect-square flex items-center justify-center relative shadow-xl hover:shadow-2xl transition-all group">
                        <img src={img} alt={`Artifact ${i + 1}`} className="max-w-full max-h-full object-contain p-4 transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute top-4 left-4 bg-[var(--bg-primary)]/80 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] border border-[var(--border-primary)] shadow-sm">
                            {isTr ? `Eser ${i + 1}` : `Artifact ${i + 1}`}
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary & Score */}
            <div className="glass-panel border-2 border-[var(--accent)] rounded-[2.5rem] p-8 md:p-12 shadow-[0_0_40px_rgba(194,141,63,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Scale size={200} /></div>

                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
                    <div className="shrink-0 flex flex-col items-center">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-primary)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="8" strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * similarity_score) / 100} className="transition-all duration-1000 ease-out" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-serif text-[var(--text-primary)]">{similarity_score}%</span>
                                <span className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">{isTr ? 'Benzerlik' : 'Match'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] mb-4">{isTr ? 'Uzman Görüşü' : 'Expert Conclusion'}</h3>
                        <p className="text-lg md:text-xl font-light leading-relaxed text-[var(--text-primary)]">{conclusion}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Specifics */}
                <div className="space-y-6">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[2rem] p-8 hover:shadow-md transition-shadow">
                        <h4 className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-6">
                            <CheckCircle2 size={16} /> {isTr ? 'Ortak Özellikler' : 'Similarities'}
                        </h4>
                        <ul className="space-y-3">
                            {similarities.map((item, idx) => (
                                <li key={idx} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5"></span>
                                    <span className="leading-relaxed">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[2rem] p-8 hover:shadow-md transition-shadow">
                        <h4 className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-6">
                            <XCircle size={16} /> {isTr ? 'Farklılıklar' : 'Differences'}
                        </h4>
                        <ul className="space-y-3">
                            {differences.map((item, idx) => (
                                <li key={idx} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5"></span>
                                    <span className="leading-relaxed">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Analysis */}
                <div className="space-y-6">
                    <div className={`p-8 rounded-[2rem] border transition-colors ${era_match ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            {era_match ? <CheckCircle2 className="text-emerald-500" /> : <XCircle className="text-red-500" />}
                            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">{isTr ? 'Dönem / Kültür Uyumu' : 'Era / Culture Match'}</h4>
                        </div>
                        <p className="text-sm font-medium text-[var(--text-secondary)]">
                            {era_match ?
                                (isTr ? 'Eserlerin üretim teknikleri ve yıpranma izleri aynı dönemden kaldıklarını güçlü şekilde işaret ediyor.' : 'Production techniques and wear indicate they strongly belong to the same era.') :
                                (isTr ? 'Eserler arasında kronolojik veya kültürel temel uyumsuzluklar tespit edildi.' : 'Chronological or cultural mismatches detected between artifacts.')}
                        </p>
                    </div>

                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[2rem] p-8">
                        <h4 className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-4">
                            <ShieldCheck size={16} /> {isTr ? 'Orijinallik / Replika İhtimali' : 'Authenticity / Replica'}
                        </h4>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{authenticity_analysis}</p>
                    </div>

                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[2rem] p-8">
                        <h4 className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-4">
                            <Microscope size={16} /> {isTr ? 'Stilistik Farklar' : 'Stylistic Nuances'}
                        </h4>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{style_differences}</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-center pt-8 border-t border-[var(--border-primary)]">
                <button
                    onClick={() => window.location.reload()}
                    className="px-10 py-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl"
                >
                    {isTr ? 'Yeni Karşılaştırma' : 'New Comparison'}
                </button>
            </div>
        </div>
    );
};
