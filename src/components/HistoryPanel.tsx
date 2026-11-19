import React from 'react';
import { History, Trash2, Clock } from 'lucide-react';
import { HistoryEntry, Language } from '../types';
import { t } from '../i18n';

interface HistoryPanelProps {
    entries: HistoryEntry[];
    isOpen: boolean;
    onClose: () => void;
    onLoad: (entry: HistoryEntry) => void;
    onClear: () => void;
    lang: Language;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = React.memo(({ entries, isOpen, onClose, onLoad, onClear, lang }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex">
            <div className="absolute inset-0 bg-[var(--bg-primary)]/40 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative ml-auto w-full max-w-md glass-panel h-full overflow-y-auto animate-slide-in-right shadow-2xl custom-scrollbar border-l border-[var(--border-primary)]">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--bg-tertiary)] text-[var(--accent)] border border-[var(--border-primary)] rounded-full flex items-center justify-center shadow-sm">
                                <History size={20} />
                            </div>
                            <h2 className="text-xl font-serif font-bold text-[var(--text-primary)]">{t('history.title', lang)}</h2>
                        </div>
                        <button aria-label={lang === 'tr' ? 'Kapat' : 'Close'} onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-2xl">&times;</button>
                    </div>

                    {entries.length === 0 ? (
                        <div className="text-center py-20">
                            <Clock className="w-12 h-12 text-[var(--border-secondary)] mx-auto mb-4" />
                            <p className="text-[var(--text-secondary)] text-sm">{t('history.empty', lang)}</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 mb-8">
                                {entries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="group bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
                                        onClick={() => { onLoad(entry); onClose(); }}
                                    >
                                        <div className="flex gap-4 p-4">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[var(--bg-primary)] border border-[var(--border-primary)]">
                                                <img src={entry.imageDataUrl} alt={entry.result.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors text-sm truncate mb-1">{entry.result.title}</h3>
                                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                                    {entry.result.origin?.region} • {entry.result.dating?.period}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-full text-[var(--accent)] font-bold shadow-sm">
                                                        %{entry.result.confidence_score}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--text-tertiary)]">
                                                        {new Date(entry.timestamp).toLocaleDateString('tr-TR')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={onClear}
                                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                            >
                                <Trash2 size={14} /> {t('history.clear', lang)}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});
