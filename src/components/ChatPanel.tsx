import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { chatWithArtifact } from '../lib/api';
import { AnalysisResult, ChatMessage, Language } from '../types';
import { t } from '../i18n';
import { useAppStore } from '../store/useAppStore';

interface ChatPanelProps {
    result: AnalysisResult;
    imageBase64: string | null;
    imageMimeType: string;
    lang: Language;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ result, imageBase64, imageMimeType, lang }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
        return () => clearTimeout(timer);
    }, [messages, isThinking]);

    const sendMessage = async () => {
        if (!input.trim() || isThinking) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        try {
            const safeText = (text: string | null | undefined): string => {
                if (!text) return 'Bilinmiyor';
                return text.replace(/[{}<>]/g, '').replace(/\n/g, ' ').substring(0, 500);
            };

            const context = `
        ESER BİLGİLERİ:
        - Başlık: ${safeText(result.title)}
        - Dönem: ${safeText(result.dating?.period)} (${safeText(result.dating?.date_range)})
        - Bölge: ${safeText(result.origin?.region)}, Kültür: ${safeText(result.origin?.culture)}
        - Malzeme: ${safeText(result.specs?.material)}, Teknik: ${safeText(result.specs?.technique)}
        - Üslup: ${safeText(result.specs?.style)}
        - Açıklama: ${safeText(result.analysis?.description)}
        - İkonografi: ${safeText(result.analysis?.iconography)}
        - Kondisyon: ${safeText(result.preservation?.condition)}
        ${lang === 'tr' ? 'Türkçe yanıtla.' : 'Answer in English.'}
      `;

            const reply = await chatWithArtifact(userMsg.content, context, imageBase64, imageMimeType);

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: reply || (lang === 'tr' ? 'Yanıt alınamadı.' : 'No response received.'),
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            useAppStore.getState().addLog('error', `[ChatError]: ${message}`);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠️ ${lang === 'tr' ? 'Bağlantı Hatası: Lütfen tekrar deneyin.' : 'Connection Error: Please try again.'}`,
                timestamp: Date.now(),
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const suggestions = lang === 'tr'
        ? [
            'Bu eserin tarihi önemi nedir?',
            'Hangi müzede sergileniyor?',
            'Benzer eserler hangileridir?',
            'Bu dönemin sanat anlayışı nasıldı?',
        ]
        : [
            'What is the historical significance?',
            'Which museum displays this?',
            'What are similar artifacts?',
            'What was the art style of this period?',
        ];

    return (
        <div className="flex flex-col h-[500px] animate-fade-in">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 pr-2">
                {messages.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-6 border border-[var(--border-primary)] shadow-sm">
                            <Sparkles className="w-8 h-8 text-[var(--accent)] animate-pulse-slow" />
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm mb-8 font-medium">{t('chat.title', lang)}</p>
                        <div className="grid grid-cols-2 gap-3" role="group" aria-label={lang === 'tr' ? 'Önerilen Sorular' : 'Suggested Questions'}>
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(s)}
                                    aria-label={s}
                                    className="text-left text-xs p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm group"
                                >
                                    <span className="opacity-70 group-hover:opacity-100">{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex items-start gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${msg.role === 'user'
                                    ? 'bg-[var(--text-primary)] border-transparent text-[var(--bg-primary)]'
                                    : 'bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--accent)]'
                                    }`}>
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                                    <p className="text-sm leading-relaxed px-5 py-3 whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {isThinking && (
                    <div className="flex justify-start">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center">
                                <Bot size={14} className="text-stone-600 dark:text-stone-300" />
                            </div>
                            <div className="chat-bubble-assistant px-4 py-3">
                                <div className="flex items-center gap-2 text-sm text-stone-400">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                    {t('chat.thinking', lang)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 glass-panel rounded-2xl p-2 border border-[var(--border-primary)] shadow-md mt-4">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.placeholder', lang)}
                    aria-label={t('chat.placeholder', lang)}
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-tertiary)] font-medium"
                    disabled={isThinking}
                />
                <button
                    onClick={sendMessage}
                    aria-label={t('chat.send', lang)}
                    disabled={!input.trim() || isThinking}
                    className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-all duration-300 flex items-center gap-2 shadow-sm"
                >
                    <Send size={14} /> {t('chat.send', lang)}
                </button>
            </div>
        </div>
    );
};
