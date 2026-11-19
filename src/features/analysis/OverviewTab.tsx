import React from 'react';
import { BookOpen, Calendar, Landmark, Sparkles, Layers, Globe, Link as LinkIcon, ExternalLink, Lightbulb, Quote } from 'lucide-react';
import { AnalysisResult, Language } from '../../types';
import { t } from '../../i18n';
import { safeExternalUrl } from '../../lib/safeHtml';

interface OverviewTabProps {
  result: AnalysisResult;
  lang: Language;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ result, lang }) => {
  const safeGroundingUrls = (result.groundingUrls || [])
    .map(u => ({ title: u.title, uri: safeExternalUrl(u.uri) }))
    .filter((u): u is { title: string; uri: string } => Boolean(u.uri));

  return (
  <div className="space-y-5 animate-fade-in">
    <OverviewSection icon={<BookOpen size={15} />} title={t('analysis.description', lang)}>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.85, fontSize: 15 }}>
        {result.analysis?.description}
      </p>
    </OverviewSection>

    {result.historical_context && (
      <OverviewSection icon={<Calendar size={15} />} title={t('analysis.historicalContext', lang)}>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
          {result.historical_context}
        </p>
      </OverviewSection>
    )}

    {result.cultural_significance && (
      <AccentCard
        color="#10b981"
        dimColor="rgba(16,185,129,0.08)"
        borderColor="rgba(16,185,129,0.18)"
        icon={<Landmark size={14} />}
        title={t('analysis.culturalSignificance', lang)}
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
          {result.cultural_significance}
        </p>
      </AccentCard>
    )}

    {result.symbolism && (
      <AccentCard
        color="#a855f7"
        dimColor="rgba(168,85,247,0.08)"
        borderColor="rgba(168,85,247,0.18)"
        icon={<Sparkles size={14} />}
        title={t('analysis.symbolism', lang)}
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
          {result.symbolism}
        </p>
      </AccentCard>
    )}

    {result.similar_artifacts && result.similar_artifacts.length > 0 && (
      <OverviewSection icon={<Layers size={15} />} title={t('analysis.similarArtifacts', lang)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.similar_artifacts.map((sa, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '12px 14px', borderRadius: 14,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                width: 28, height: 28, background: 'var(--bg-elevated)',
                border: '1px solid var(--border-secondary)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 11, fontWeight: 800, color: 'var(--accent)'
              }}>
                {idx + 1}
              </div>
              <div>
                <h5 style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{sa.name}</h5>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '2px 0 0' }}>{sa.museum}</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sa.similarity}</p>
              </div>
            </div>
          ))}
        </div>
      </OverviewSection>
    )}

    {safeGroundingUrls.length > 0 && (
      <AccentCard
        color="#3b82f6"
        dimColor="rgba(59,130,246,0.07)"
        borderColor="rgba(59,130,246,0.15)"
        icon={<Globe size={14} />}
        title={t('analysis.sources', lang)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {safeGroundingUrls.map((url, idx) => (
            <a key={idx} href={url.uri} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 12,
              border: '1px solid var(--border-primary)', textDecoration: 'none',
              transition: 'all 0.2s', gap: 10
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <LinkIcon size={12} style={{ color: '#3b82f6' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {url.title}
                </span>
              </div>
              <ExternalLink size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </a>
          ))}
        </div>
      </AccentCard>
    )}

    {result.fun_fact && (
      <AccentCard
        color="var(--accent)"
        dimColor="var(--accent-bg)"
        borderColor="rgba(var(--accent-rgb),0.2)"
        icon={<Lightbulb size={14} />}
        title={t('analysis.funFact', lang)}
      >
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.7 }}>
          "{result.fun_fact}"
        </p>
      </AccentCard>
    )}

    {/* Curator note */}
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
      borderRadius: 20, padding: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <div style={{
          width: 32, height: 32, background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-secondary)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-tertiary)'
        }}>
          <Quote size={14} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {t('analysis.curatorNote', lang)}
        </span>
      </div>
      <p style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 18, fontStyle: 'italic', lineHeight: 1.7,
        color: 'var(--text-primary)',
        paddingLeft: '1rem',
        borderLeft: '2px solid var(--border-strong)',
        margin: 0
      }}>
        "{result.curator_note}"
      </p>
    </div>
  </div>
  );
};

const OverviewSection = ({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="overview-section">
    <div className="overview-section-header">
      <div className="overview-section-icon">{icon}</div>
      <span className="overview-section-title">{title}</span>
    </div>
    {children}
  </div>
);

interface AccentCardProps {
  color: string;
  dimColor: string;
  borderColor: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const AccentCard: React.FC<AccentCardProps> = ({ color, dimColor, borderColor, icon, title, children }) => (
  <div style={{ background: dimColor, border: `1px solid ${borderColor}`, borderRadius: 20, padding: '1.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${dimColor}`,
        border: `1px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color, flexShrink: 0
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: color }}>
        {title}
      </span>
    </div>
    {children}
  </div>
);

