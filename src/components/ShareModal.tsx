import React, { useState } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { t } from '../i18n';

interface ShareModalProps {
    result: AnalysisResult;
    isOpen: boolean;
    onClose: () => void;
    onDownloadPdf: () => void;
    lang: Language;
}

export const ShareModal: React.FC<ShareModalProps> = ({ result, isOpen, onClose, onDownloadPdf, lang }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const shareText = `${result.title} — ${result.origin?.region}, ${result.dating?.period}\n${result.analysis?.description?.slice(0, 150)}...\n\n${lang === 'tr' ? 'ArcheLens Open Source ile analiz edildi' : 'Analyzed with ArcheLens Open Source'}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTwitter = () => {
        const text = encodeURIComponent(`🏛️ ${result.title} — ${result.dating?.period}\n\n${lang === 'tr' ? 'ArcheLens Open Source ile analiz edildi!' : 'Analyzed with ArcheLens Open Source!'}`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    const handleWhatsApp = () => {
        const text = encodeURIComponent(shareText);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-[var(--bg-secondary)] rounded-[2rem] max-w-md w-full relative z-10 shadow-2xl animate-bounce-in overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full flex items-center justify-center transition-colors"
                >
                    <X size={16} className="text-[var(--text-secondary)] dark:text-stone-400" />
                </button>

                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full flex items-center justify-center">
                            <Share2 size={18} />
                        </div>
                        <h3 className="text-lg font-serif font-bold text-[var(--text-primary)]">{t('share.title', lang)}</h3>
                    </div>

                    {/* Preview */}
                    <div className="bg-stone-50 dark:bg-stone-800 p-5 rounded-2xl mb-6 border border-stone-200 dark:border-stone-700">
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{result.title}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{result.origin?.region} • {result.dating?.period}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2">{result.analysis?.description?.slice(0, 120)}...</p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleCopy}
                            className="w-full flex items-center justify-between p-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />}
                                <span className="text-sm font-medium text-[var(--text-primary)] dark:text-stone-300">{copied ? t('share.copied', lang) : t('share.copyLink', lang)}</span>
                            </div>
                        </button>

                        <button
                            onClick={handleTwitter}
                            className="w-full flex items-center gap-3 p-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:shadow-md transition-all"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-stone-900 dark:text-stone-100">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span className="text-sm font-medium text-[var(--text-primary)] dark:text-stone-300">{t('share.twitter', lang)}</span>
                        </button>

                        <button
                            onClick={handleWhatsApp}
                            className="w-full flex items-center gap-3 p-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:shadow-md transition-all"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-green-600">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{t('share.whatsapp', lang)}</span>
                        </button>

                        <button
                            onClick={onDownloadPdf}
                            className="w-full flex items-center gap-3 p-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl hover:opacity-90 transition-all"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                            </svg>
                            <span className="text-sm font-bold">{t('share.download', lang)}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
