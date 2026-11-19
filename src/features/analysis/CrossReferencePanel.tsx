import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, Globe } from 'lucide-react';
import { fetchCrossReference } from '../../lib/api';
import { CrossRefItem } from '../../types';
import { AnalysisResult, Language } from '../../types';

interface CrossReferencePanelProps {
  result: AnalysisResult;
  lang: Language;
}

export const CrossReferencePanel: React.FC<CrossReferencePanelProps> = ({ result, lang }) => {
  const tr = lang === 'tr';

  const params = {
    period:   result.dating?.period   || '',
    material: result.specs?.material  || '',
    culture:  result.origin?.culture  || '',
    type:     result.inventory?.type  || '',
  };

  const { data, isLoading, isError } = useQuery<{ results: CrossRefItem[]; cached?: boolean }>({
    queryKey: ['cross-reference', params.period, params.material, params.culture],
    queryFn: () => fetchCrossReference(params) as Promise<{ results: CrossRefItem[]; cached?: boolean }>,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    retry: false,
    enabled: !!(params.period || params.material || params.culture),
  });

  const items: CrossRefItem[] = data?.results || [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-10 justify-center text-[var(--text-tertiary)]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
        <span className="text-xs font-semibold uppercase tracking-widest">
          {tr ? 'Müze koleksiyonları taranıyor...' : 'Scanning museum collections...'}
        </span>
      </div>
    );
  }

  if (isError || items.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--text-tertiary)] text-xs">
        {tr ? 'Eşleşen referans eser bulunamadı.' : 'No matching reference artifacts found.'}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-[var(--accent)]" />
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
          {tr ? `${items.length} Koleksiyon Eşleşmesi` : `${items.length} Collection Match${items.length > 1 ? 'es' : ''}`}
        </h4>
        {data?.cached && (
          <span className="text-[9px] text-[var(--text-tertiary)] border border-[var(--border-primary)] rounded-full px-2 py-0.5">
            {tr ? 'önbellekten' : 'cached'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <CrossRefCard key={i} item={item} lang={lang} />
        ))}
      </div>
    </div>
  );
};

const CrossRefCard: React.FC<{ item: CrossRefItem; lang: Language }> = ({ item, lang }) => {
  const tr = lang === 'tr';

  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden
        hover:border-[var(--accent)] hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative h-40 bg-stone-900 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Globe className="w-8 h-8 text-stone-600" />
          </div>
        )}
        {/* Museum badge */}
        <div className="absolute bottom-2 left-2">
          <span className="bg-stone-900/90 backdrop-blur text-[9px] font-bold text-stone-300 px-2 py-1 rounded-lg">
            {item.museum}
          </span>
        </div>
        {/* External link icon */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3.5 h-3.5 text-white drop-shadow" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-snug">
          {item.title}
        </p>
        {item.date && (
          <p className="text-[10px] text-[var(--text-secondary)]">{item.date}</p>
        )}
        {item.culture && (
          <p className="text-[10px] text-[var(--text-tertiary)] italic">{item.culture}</p>
        )}
      </div>
    </a>
  );
};
