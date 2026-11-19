import React from 'react';
import { Calendar, Circle } from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { t } from '../i18n';

interface TimelineProps {
    result: AnalysisResult;
    lang: Language;
}

interface TimelineEvent {
    year: string;
    numericYear: number;
    title: string;
    description: string;
    isCurrent?: boolean;
}

function parseYearToNumeric(yearStr: string): number {
    if (!yearStr || yearStr === '?') return 2024; // fallback for current/unknown

    const cleaned = yearStr.trim().toUpperCase();

    // Check for century specifically first (e.g., "19TH CENTURY", "19. YÜZYIL")
    if (cleaned.includes('YÜZYIL') || cleaned.includes('CENTURY') || cleaned.match(/\d+(TH|ST|ND|RD)\s+C/)) {
        const numMatch = cleaned.match(/(\d+)/);
        if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            return (cleaned.includes('MÖ') || cleaned.includes('BC')) ? -num * 100 : num * 100;
        }
    }

    // Check for decades (e.g., "1990S", "1990'LAR")
    if (cleaned.match(/(\d{4})[']?S/) || cleaned.match(/(\d{4})[']?[Ll]A/)) {
        const numMatch = cleaned.match(/(\d{4})/);
        if (numMatch) return parseInt(numMatch[1], 10);
    }

    const rangeParts = cleaned.split(/[-–]/);
    const firstPart = rangeParts[0].trim();
    const numMatch = firstPart.match(/(\d+)/);

    if (!numMatch) {
        // Fallback for purely text descriptions (e.g. "Modern", "Contemporary")
        if (cleaned.includes('MODERN') || cleaned.includes('ÇAĞDAŞ') || cleaned.includes('CONTEMPORARY')) return 2000;
        if (cleaned.includes('RENAISSANCE') || cleaned.includes('RÖNESANS')) return 1500;
        if (cleaned.includes('MEDIEVAL') || cleaned.includes('ORTA ÇAĞ')) return 1000;
        return 0; // Default unknown
    }

    const num = parseInt(numMatch[1], 10);

    if (firstPart.includes('MÖ') || firstPart.includes('BC') || cleaned.includes('MÖ') || cleaned.includes('BC')) return -num;
    if (firstPart.includes('MS') || firstPart.includes('AD') || cleaned.includes('MS') || cleaned.includes('AD')) return num;

    // If it's a 4-digit number and no BC/MÖ is specified, assume AD (e.g., "1995")
    if (num > 1000 && num <= 2100) return num;

    // Ambiguous numbers without markers -> default to AD for small numbers unless context implies otherwise, 
    // but the previous logic assumed > 500 was BC. Let's fix this heavily bias assumption.
    // If it's a small number without century marker, it's often a year AD. 
    return num;
}

function generateTimelineEvents(result: AnalysisResult, lang: Language): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Safely extract dating fields using optional chaining to avoid TS errors
    const dateRange = result.dating?.date_range || '';
    const century = result.dating?.century || '';
    const period = result.dating?.period || '';
    const tr = lang === 'tr';

    // Best effort to find a date string
    const artifactYearStr = dateRange || century || period || '?';
    const artifactYear = parseYearToNumeric(artifactYearStr);

    events.push({
        year: artifactYearStr !== '?' ? artifactYearStr : (tr ? 'Günümüz' : 'Modern'),
        numericYear: artifactYear,
        title: result.title || (tr ? 'Eser' : 'Artifact'),
        description: tr ? `${result.origin?.culture || 'Bilinmeyen'} kültürüne ait eser` : `Artifact from ${result.origin?.culture || 'unknown'} culture`,
        isCurrent: true,
    });

    if (result.historical_context) {
        // Create events directly from the AI context to make it dynamic
        // We split the historical context by sentences loosely, and bundle them into entries
        const sentences = result.historical_context.split(/(?<=[.!?])\s+(?=[A-ZÖÜİŞÇĞ])/);

        if (sentences.length > 0) {
            events.push({
                year: period || (tr ? 'Dönem' : 'Period'),
                numericYear: artifactYear - 1, // Order right before current
                title: tr ? 'Tarihsel Arka Plan' : 'Historical Background',
                description: sentences.slice(0, Math.ceil(sentences.length / 2)).join(' '),
            });
        }
        if (sentences.length > 1) {
            const centuryOrLater = century || (tr ? 'Sonrası' : 'Afterwards');
            events.push({
                year: centuryOrLater,
                numericYear: artifactYear + 1, // Order right after current
                title: tr ? 'Kültürel Etki' : 'Cultural Impact',
                description: sentences.slice(Math.ceil(sentences.length / 2)).join(' '),
            });
        }
    } else {
        // Fallback generic events if no context
        events.push(
            { year: tr ? 'MÖ 10000' : '10000 BC', numericYear: -10000, title: tr ? 'Neolitik Devrim' : 'Neolithic Revolution', description: tr ? 'Tarım başlangıcı' : 'Beginning of agriculture' },
            { year: tr ? 'MÖ 3500' : '3500 BC', numericYear: -3500, title: tr ? 'Yazının İcadı' : 'Invention of Writing', description: tr ? 'Mezopotamya\'da çivi yazısı' : 'Cuneiform in Mesopotamia' },
            { year: tr ? 'MÖ 3000' : '3000 BC', numericYear: -3000, title: tr ? 'Bronz Çağı' : 'Bronze Age', description: tr ? 'Metal işçiliğinin başlangıcı' : 'Beginning of metalworking' },
            { year: tr ? 'MÖ 1200' : '1200 BC', numericYear: -1200, title: tr ? 'Demir Çağı' : 'Iron Age', description: tr ? 'Demir teknolojisinin yayılması' : 'Spread of iron technology' },
        );
    }

    events.sort((a, b) => a.numericYear - b.numericYear);
    return events;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({ result, lang }) => {
    const events = generateTimelineEvents(result, lang);
    return (
        <div className="relative py-8 animate-fade-in">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {t('timeline.title', lang)}
            </h3>
            <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-stone-300 dark:via-stone-600 to-transparent"></div>
                <div className="space-y-8">
                    {events.map((event, idx) => (
                        <div key={idx} className={`relative flex items-start gap-6 pl-4 transition-all duration-300 ${event.isCurrent ? 'scale-[1.02]' : ''}`}>
                            <div className={`relative z-10 mt-1 shrink-0 ${event.isCurrent ? 'w-8 h-8' : 'w-4 h-4'} rounded-full flex items-center justify-center`}>
                                {event.isCurrent ? (
                                    <div className="w-8 h-8 bg-stone-900 dark:bg-stone-100 rounded-full flex items-center justify-center shadow-lg shadow-stone-900/20 animate-pulse-glow">
                                        <Circle className="w-3 h-3 text-white dark:text-stone-900 fill-current" />
                                    </div>
                                ) : (
                                    <div className="w-4 h-4 bg-stone-300 dark:bg-stone-600 rounded-full border-2 border-[var(--bg-primary)]"></div>
                                )}
                            </div>
                            <div className={`flex-1 pb-2 ${event.isCurrent ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 p-6 rounded-2xl shadow-xl -ml-2' : ''}`}>
                                <div className="flex items-baseline gap-3 mb-1">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${event.isCurrent ? 'text-stone-300 dark:text-stone-500' : 'text-stone-400'}`}>{event.year}</span>
                                </div>
                                <h4 className={`font-serif text-lg font-bold ${event.isCurrent ? '' : 'text-stone-900 dark:text-stone-100'}`}>{event.title}</h4>
                                <p className={`text-sm mt-1 ${event.isCurrent ? 'text-stone-300 dark:text-stone-500' : 'text-stone-500 dark:text-stone-400'}`}>{event.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
