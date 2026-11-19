import { Language, Translations } from '../types';
import { tr } from './tr';
import { en } from './en';

const translations: Record<Language, Translations> = { tr, en };

export function t(key: string, lang: Language = 'tr'): string {
    return translations[lang]?.[key] || translations['tr']?.[key] || key;
}

export function getLanguages(): { code: Language; label: string }[] {
    return [
        { code: 'tr', label: 'Türkçe' },
        { code: 'en', label: 'English' },
    ];
}
