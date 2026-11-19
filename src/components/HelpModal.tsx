import React from 'react';
import { X, Info, Sparkles, Hexagon, Cpu, Image, Zap, Search, MessageCircle, Camera, Link as LinkIcon } from 'lucide-react';
import { Language } from '../types';
import { t } from '../i18n';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, lang }) => {
    if (!isOpen) return null;
    const isTr = lang === 'tr';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-[var(--bg-primary)]/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="glass-panel border justify-center border-[var(--border-primary)] rounded-2xl sm:rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl animate-fade-in-up custom-scrollbar">
                <button onClick={onClose} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-full flex items-center justify-center transition-all duration-300 z-20 shadow-sm hover:scale-105 active:scale-95">
                    <X size={20} className="text-[var(--text-secondary)]" />
                </button>
                <div className="p-6 sm:p-8 md:p-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] shadow-sm text-[var(--accent)] rounded-full flex items-center justify-center shrink-0">
                            <Info size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[var(--text-primary)]">{t('help.title', lang)}</h2>
                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t('help.version', lang)}</p>
                        </div>
                    </div>
                    <div className="space-y-8">

                        {/* AI Engines */}
                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-2">
                                {isTr ? 'Yapay Zeka Motorları' : 'AI Engines'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Cpu size={16} className="text-violet-600 dark:text-violet-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">Google Gemini AI</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                        {isTr ? 'Yapılandırılabilir eser tanımlama, dönem tespiti ve akademik analiz motoru. Google Search ile çapraz doğrulama yapar.' : 'Configurable artifact identification, dating, and academic analysis engine. Cross-validates with Google Search.'}
                                    </p>
                                </div>
                                <div className="p-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Image size={16} className="text-[var(--accent)] text-amber-600 dark:text-amber-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] text-amber-700 dark:text-amber-400">Nano Banana Pro</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                        {isTr ? 'Dijital restorasyon ve görsel yeniden oluşturma motoru. Kırık parçaları tamamlar, renk sapmalarını giderir.' : 'Digital restoration and visual reconstruction engine. Completes broken pieces, removes color casts.'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Analysis Process */}
                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-2">{t('help.section1Title', lang)}</h3>
                            <p className="text-[var(--text-secondary)] leading-relaxed mb-4 text-sm">
                                {t('help.section1Desc', lang)}
                            </p>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[
                                    { icon: <Camera size={18} className="text-[var(--accent)]" />, label: isTr ? 'Kamera' : 'Camera' },
                                    { icon: <Zap size={18} className="text-[var(--accent)]" />, label: 'Drag & Drop' },
                                    { icon: <LinkIcon size={18} className="text-[var(--accent)]" />, label: 'URL' },
                                ].map((item, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] shadow-sm">
                                        {item.icon}
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] text-center">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl text-xs text-[var(--text-secondary)] border border-[var(--border-primary)]">
                                <strong className="text-[var(--text-primary)]">💡 </strong>{t('help.section1Tip', lang)}
                            </div>
                        </section>

                        {/* Restoration */}
                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-2">{t('help.section2Title', lang)}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-amber-50/50 dark:bg-[var(--bg-tertiary)] p-5 rounded-2xl border border-[var(--border-primary)]">
                                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Sparkles className="text-[var(--accent)]" size={16} />{isTr ? 'Renk Doğruluğu' : 'Color Accuracy'}</h4>
                                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                                        {isTr ? 'Nano Banana Pro, malzemenin orijinal yapısını analiz ederek gerçek renk tonlarını ortaya çıkarır.' : 'Nano Banana Pro analyzes the original material structure to reveal true color tones.'}
                                    </p>
                                </div>
                                <div className="bg-blue-50/50 dark:bg-[var(--bg-tertiary)] p-5 rounded-2xl border border-[var(--border-primary)]">
                                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Hexagon className="text-blue-500" size={16} />{isTr ? 'Yapısal Bütünlük' : 'Structural Integrity'}</h4>
                                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                                        {isTr ? 'Kırık veya eksik parçalar bağlamsal geometri analizi ile tamamlanır.' : 'Broken or missing pieces are completed with contextual geometry analysis.'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Modes */}
                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-2">{t('help.section3Title', lang)}</h3>
                            <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
                                <li className="flex gap-3">
                                    <span className="font-bold text-[var(--text-primary)] shrink-0">{isTr ? 'Bağlamsal Onarım:' : 'Contextual Repair:'}</span>
                                    <span>{isTr ? 'Nano Banana Pro malzeme türüne göre otomatik olarak düzeltir.' : 'Nano Banana Pro automatically corrects based on material type.'}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-[var(--text-primary)] shrink-0">{isTr ? 'Manuel Mod:' : 'Manual Mode:'}</span>
                                    <span>{isTr ? 'Özel komutlar girerek belirli bölgeleri restore edin.' : 'Restore specific areas with custom commands.'}</span>
                                </li>
                            </ul>
                        </section>

                        {/* Features Grid */}
                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-2">
                                {isTr ? '4. Özellikler' : '4. Features'}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { icon: <Search size={14} className="text-[var(--text-secondary)]" />, label: 'Google Search' },
                                    { icon: <MessageCircle size={14} className="text-[var(--text-secondary)]" />, label: isTr ? 'AI Sohbet' : 'AI Chat' },
{ icon: <Image size={14} className="text-[var(--text-secondary)]" />, label: isTr ? 'Restorasyon' : 'Restoration' },
                                    { icon: <Zap size={14} className="text-[var(--text-secondary)]" />, label: 'PDF Export' },
                                    { icon: <Sparkles size={14} className="text-[var(--accent)]" />, label: isTr ? 'Harita & Tarihçe' : 'Map & Timeline' },
                                ].map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 p-3 bg-[var(--bg-primary)] rounded-lg text-[11px] font-medium text-[var(--text-secondary)] tracking-wide border border-[var(--border-primary)] shadow-sm">
                                        {f.icon} {f.label}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};
