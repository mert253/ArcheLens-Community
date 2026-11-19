import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, ExternalLink, Loader2, Search, Image as ImageIcon } from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { t } from '../i18n';

interface MuseumArtifact {
    id: number;
    title: string;
    date: string;
    medium: string;
    culture: string;
    period: string;
    department: string;
    imageUrl: string;
    museumUrl: string;
    artist: string;
    dimensions: string;
}

interface WikiResult {
    title: string;
    extract?: string;
    thumbnail?: string;
    url?: string;
    description?: string;
}

interface MuseumPanelProps {
    result: AnalysisResult;
    lang: Language;
}

const metMuseumCache = new Map<string, MuseumArtifact[]>();
const wikiCache = new Map<string, WikiResult | null>();

// We now use the i18n system for translations
const translateQuery = (query: string, lang: Language): string => {
    if (lang !== 'tr') return query;
    let translated = query.toLowerCase();

    // Use the i18n dictionary for mapping common terms
    const terms = translated.split(' ');
    const mappedTerms = terms.map(term => {
        const key = `museum.dict.${term}`;
        const translation = t(key, lang);
        // If the translation returns the key itself, it means not found, keep original
        return translation !== key ? translation : term;
    });

    return mappedTerms.join(' ');
};

export const MuseumPanel: React.FC<MuseumPanelProps> = ({ result, lang }) => {
    const [museumResults, setMuseumResults] = useState<MuseumArtifact[]>([]);
    const [wikiData, setWikiData] = useState<WikiResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isTr = lang === 'tr';

    // Direct Met Museum API call (CORS-friendly public API)
    const searchMetMuseum = async (query: string): Promise<MuseumArtifact[]> => {
        if (metMuseumCache.has(query)) return metMuseumCache.get(query)!;
        try {
            const searchRes = await fetch(
                `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`
            );
            const searchData = await searchRes.json();

            if (!searchData.objectIDs || searchData.objectIDs.length === 0) {
                // Try with just culture
                const culture = translateQuery(result.origin?.culture || '', lang);
                if (culture) {
                    const retryRes = await fetch(
                        `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(culture)}`
                    );
                    const retryData = await retryRes.json();
                    if (!retryData.objectIDs || retryData.objectIDs.length === 0) return [];
                    searchData.objectIDs = retryData.objectIDs;
                } else {
                    return [];
                }
            }

            const ids = searchData.objectIDs.slice(0, 8);
            const details = await Promise.all(
                ids.map(async (id: number) => {
                    try {
                        const objRes = await fetch(
                            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
                        );
                        const obj = await objRes.json();
                        if (!obj.primaryImageSmall && !obj.primaryImage) return null;
                        return {
                            id: obj.objectID,
                            title: obj.title,
                            date: obj.objectDate,
                            medium: obj.medium,
                            culture: obj.culture,
                            period: obj.period,
                            department: obj.department,
                            imageUrl: obj.primaryImageSmall || obj.primaryImage,
                            museumUrl: obj.objectURL,
                            artist: obj.artistDisplayName,
                            dimensions: obj.dimensions,
                        };
                    } catch { return null; }
                })
            );

            const finalResult = details.filter(Boolean) as MuseumArtifact[];
            metMuseumCache.set(query, finalResult);
            return finalResult;
        } catch {
            return [];
        }
    };

    // Direct Wikipedia API call
    const searchWikipedia = async (query: string): Promise<WikiResult | null> => {
        if (wikiCache.has(query)) return wikiCache.get(query)!;
        try {
            // Try direct summary first
            const wikiRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, '_'))}`
            );

            if (wikiRes.ok) {
                const data = await wikiRes.json();
                const resultObj = {
                    title: data.title,
                    description: data.description,
                    extract: data.extract,
                    thumbnail: data.thumbnail?.source,
                    url: data.content_urls?.desktop?.page,
                };
                wikiCache.set(query, resultObj);
                return resultObj;
            }

            // Fallback: search
            const searchRes = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1&origin=*`
            );
            const searchData = await searchRes.json();
            const firstResult = searchData.query?.search?.[0];
            if (!firstResult) {
                wikiCache.set(query, null);
                return null;
            }

            // Get summary of first search result
            const summaryRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title.replace(/ /g, '_'))}`
            );
            if (!summaryRes.ok) {
                wikiCache.set(query, null);
                return null;
            }
            const summaryData = await summaryRes.json();
            const resultObj = {
                title: summaryData.title,
                description: summaryData.description,
                extract: summaryData.extract,
                thumbnail: summaryData.thumbnail?.source,
                url: summaryData.content_urls?.desktop?.page,
            };
            wikiCache.set(query, resultObj);
            return resultObj;
        } catch {
            wikiCache.set(query, null);
            return null;
        }
    };

    const searchMuseum = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSearched(true);

        try {
            // Build search query
            const rawQuery = [
                result.title,
                result.origin?.culture,
                result.specs?.material,
            ].filter(Boolean).join(' ').slice(0, 100);

            const query = translateQuery(rawQuery, lang);

            // Direct API calls (no backend needed)
            const [museumRes, wikiRes] = await Promise.allSettled([
                searchMetMuseum(query),
                searchWikipedia(result.title),
            ]);

            if (museumRes.status === 'fulfilled') {
                setMuseumResults(museumRes.value);
            }
            if (wikiRes.status === 'fulfilled' && wikiRes.value) {
                setWikiData(wikiRes.value);
            }
        } catch (err: unknown) {
            setError(isTr ? 'Müze veritabanına bağlanılamadı.' : 'Could not connect to museum database.');
        } finally {
            setLoading(false);
        }
    }, [result, lang, isTr]); // useCallback dependencies

    useEffect(() => {
        if (result && !searched) {
            searchMuseum();
        }
    }, [result, searched, searchMuseum]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {isTr ? 'Müze veritabanları taranıyor...' : 'Searching museum databases...'}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-200 dark:border-red-800 animate-fade-in">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button onClick={searchMuseum} className="mt-3 text-xs font-bold text-red-600 underline">{isTr ? 'Tekrar Dene' : 'Retry'}</button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Wikipedia */}
            {wikiData && (
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start gap-4">
                        {wikiData.thumbnail && (
                            <img src={wikiData.thumbnail} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 border border-blue-200 dark:border-blue-700" />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-blue-600"><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.407 0 .21.103.58.311 1.107l3.912 8.903 1.992-4.136-1.854-3.993c-.536-1.073-.851-1.707-1.267-1.904-.253-.12-.554-.24-1.069-.271-.191-.023-.286-.074-.286-.157V4.898l.052-.045h4.901l.051.045v.434c0 .119-.075.176-.224.176l-.543.031c-.484.029-.706.164-.706.407 0 .21.092.559.278 1.046l1.234 2.692 1.107-2.138c.282-.569.423-1.015.423-1.336 0-.353-.217-.565-.651-.635l-.546-.071c-.152 0-.228-.051-.228-.157v-.455l.051-.045c1.013-.005 3.637 0 3.637 0l.051.045v.434c0 .108-.064.163-.193.163-.537.038-.881.12-1.029.253-.222.193-.551.68-.986 1.459L11.5 10.596l2.238 4.746c.399.834.793 1.458 1.181 1.873.273.289.6.443 1.083.493.167.016.224.066.224.177v.434l-.051.045h-3.752l-.051-.045v-.434c0-.119.068-.176.204-.176.486-.028.735-.164.735-.407 0-.198-.104-.579-.312-1.137z" /></svg>
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Wikipedia</span>
                            </div>
                            <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{wikiData.title}</h4>
                            {wikiData.description && <p className="text-[10px] text-blue-500 italic mb-2">{wikiData.description}</p>}
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4">{wikiData.extract}</p>
                            {wikiData.url && (
                                <a href={wikiData.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors">
                                    {isTr ? 'Wikipedia\'da Oku' : 'Read on Wikipedia'} <ExternalLink size={10} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Met Museum Results */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-[var(--accent)]" />
                        {isTr ? 'İlgili Eserler — Metropolitan Sanat Müzesi' : 'Related Artifacts — The Metropolitan Museum of Art'}
                    </h4>
                    <button onClick={searchMuseum} className="text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-1 transition-colors">
                        <Search size={12} /> {isTr ? 'Yenile' : 'Refresh'}
                    </button>
                </div>

                {museumResults.length === 0 && searched ? (
                    <div className="text-center py-12 bg-[var(--bg-tertiary)]/50 rounded-2xl glass-panel border border-[var(--border-primary)] shadow-inner">
                        <ImageIcon className="w-8 h-8 text-[var(--border-secondary)] mx-auto mb-3" />
                        <p className="text-sm text-[var(--text-secondary)] font-medium">{isTr ? 'İlgili eser bulunamadı.' : 'No related artifacts found.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {museumResults.map((item) => (
                            <a
                                key={item.id}
                                href={item.museumUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group glass-panel rounded-2xl border border-[var(--border-primary)] overflow-hidden hover:shadow-[var(--card-hover-shadow)] hover:border-[var(--accent)] transition-all duration-300 hover:-translate-y-1 block relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-secondary)]/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
                                <div className="aspect-[4/3] bg-[var(--bg-primary)] overflow-hidden relative">
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                                <div className="p-4 relative z-20">
                                    <h5 className="text-sm font-bold text-[var(--text-primary)] line-clamp-2 mb-1 group-hover:text-[var(--accent)] transition-colors duration-300">{item.title}</h5>
                                    <p className="text-[10px] text-[var(--text-secondary)] mb-3">{item.date}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.culture && <span className="text-[9px] font-bold bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] px-2 py-0.5 rounded-full shadow-sm">{item.culture}</span>}
                                        {item.medium && <span className="text-[9px] font-bold bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)] px-2 py-0.5 rounded-full truncate max-w-[120px] shadow-sm">{item.medium}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-3 text-[9px] font-bold text-[var(--accent)] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <ExternalLink size={10} strokeWidth={2.5} /> {isTr ? 'Müzede Görüntüle' : 'View in Museum'}
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
