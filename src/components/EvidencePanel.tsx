import React from 'react';
import { BookOpen, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { EvidenceRef } from '../types';

interface EvidencePanelProps {
  evidenceRefs: EvidenceRef[];
  confidenceScore: number;
  hasEvidence: boolean;
  lang: 'tr' | 'en';
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  evidenceRefs, confidenceScore, hasEvidence, lang,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const tr = lang === 'tr';

  if (!hasEvidence) {
    return (
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-amber-300 text-xs font-semibold">
            {tr ? 'Yeterli referans bulunamadı — sonuç spekülatif' : 'Insufficient references found — result is speculative'}
          </p>
          <p className="text-amber-300/70 text-[11px] mt-0.5">
            {tr
              ? 'Benzer referans eser tespit edilemedi. Restorasyon genel arkeolojik bilgiye dayanmaktadır.'
              : 'No comparable reference artifact found. Restoration is based on general archaeological knowledge.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-emerald-300 text-xs font-semibold">
              {tr ? `${evidenceRefs.length} kanıt referansı bulundu` : `${evidenceRefs.length} evidence reference(s) found`}
            </span>
            <span className="ml-2 text-emerald-400/60 text-[10px]">
              {tr ? `Güven: %${confidenceScore}` : `Confidence: ${confidenceScore}%`}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400/60" />
          : <ChevronDown className="w-3.5 h-3.5 text-emerald-400/60" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-emerald-500/10 pt-3">
          {evidenceRefs.map((ref, i) => (
            <div key={i} className="bg-[var(--bg-primary)]/40 rounded-xl p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[var(--text-primary)] text-xs font-semibold">{ref.name}</p>
                  <p className="text-[var(--text-secondary)] text-[10px]">{ref.museum}</p>
                </div>
                <span className="ml-auto text-emerald-400 text-[10px] font-bold whitespace-nowrap">
                  {ref.similarity}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] text-[10px] leading-relaxed pl-5">
                {ref.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
