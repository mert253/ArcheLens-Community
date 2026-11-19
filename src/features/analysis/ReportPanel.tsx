import React, { useState } from 'react';
import {
  Share2, Star, MapPin, History as HistoryIcon, Users, Loader2,
  BookOpen, GraduationCap, Wrench, Package, Link2, Globe, Clock, MessageSquare, Building2
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore, TabKey } from '../../store/useUIStore';
import { createWorkspace } from '../collab/CollabWorkspace';
import { t } from '../../i18n';
import { AudioGuideCard } from '../../components/AudioGuideCard';
import { PdfExport } from '../../components/PdfExport';
import { MapView } from '../../components/MapView';
import { Timeline } from '../../components/Timeline';
import { ChatPanel } from '../../components/ChatPanel';
import { MuseumPanel } from '../../components/MuseumPanel';
import { OverviewTab } from './OverviewTab';
import { AcademicTab } from './AcademicTab';
import { TechnicalTab } from './TechnicalTab';
import { InventoryPanel } from './InventoryPanel';
import { CrossReferencePanel } from './CrossReferencePanel';
import { safeImageSource } from '../../lib/safeHtml';

export const ReportPanel: React.FC = () => {
  const { result, image, imageBase64, imageMimeType, user } = useAppStore();
  const { activeTab, lang, setActiveTab, updateUI } = useUIStore();
  const [collabLoading, setCollabLoading] = useState(false);

  const startCollab = async () => {
    if (!result || !user) return;
    setCollabLoading(true);
    const snapshot = imageBase64
      ? safeImageSource(`data:${imageMimeType};base64,${imageBase64}`)
      : safeImageSource(image);
    // Object URLs belong to one browser and cannot be shared with collaborators.
    const durableImage = snapshot.startsWith('data:') ? snapshot : undefined;
    const id = await createWorkspace(user.id, result.title, result, durableImage);
    setCollabLoading(false);
    if (id) {
      const url = `${window.location.origin}/workspace/${id}`;
      navigator.clipboard.writeText(url);
      updateUI({ appMode: 'workspace', workspaceId: id });
    }
  };

  if (!result) return null;

  const tabs: { key: TabKey | 'inventory' | 'crossref'; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',  label: t('analysis.overview', lang),  icon: <BookOpen className="report-tab-icon" /> },
    { key: 'academic',  label: t('analysis.academic', lang),  icon: <GraduationCap className="report-tab-icon" /> },
    { key: 'technical', label: t('analysis.technical', lang), icon: <Wrench className="report-tab-icon" /> },
    { key: 'inventory', label: lang === 'tr' ? 'Envanter' : 'Inventory', icon: <Package className="report-tab-icon" /> },
    { key: 'crossref',  label: lang === 'tr' ? 'Referanslar' : 'References', icon: <Link2 className="report-tab-icon" /> },
    { key: 'map',       label: t('analysis.map', lang),       icon: <Globe className="report-tab-icon" /> },
    { key: 'timeline',  label: t('analysis.timeline', lang),  icon: <Clock className="report-tab-icon" /> },
    { key: 'chat',      label: t('analysis.chat', lang),      icon: <MessageSquare className="report-tab-icon" /> },
    { key: 'museum',    label: t('analysis.museum', lang),    icon: <Building2 className="report-tab-icon" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab as string) {
      case 'overview':  return <OverviewTab result={result} lang={lang} />;
      case 'academic':  return <AcademicTab result={result} lang={lang} />;
      case 'technical': return <TechnicalTab result={result} lang={lang} />;
      case 'inventory': return <InventoryPanel result={result} lang={lang} />;
      case 'crossref':  return <CrossReferencePanel result={result} lang={lang} />;
      case 'map':       return <MapView result={result} lang={lang} />;
      case 'timeline':  return <Timeline result={result} lang={lang} />;
      case 'chat':      return <ChatPanel result={result} imageBase64={imageBase64} imageMimeType={imageMimeType} lang={lang} />;
      case 'museum':    return <MuseumPanel result={result} lang={lang} />;
      default:          return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '2rem' }}>
        {/* Action chips row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span className="action-chip" style={{
            background: 'var(--text-primary)', color: 'var(--bg-primary)', cursor: 'default', borderColor: 'transparent'
          }}>
            {t('analysis.report', lang)}
          </span>

          <span className="action-chip" style={{ cursor: 'default' }}>
            <Star size={11} style={{ fill: 'var(--accent)', color: 'var(--accent)' }} />
            {t('analysis.confidence', lang)}: %{result.confidence_score}
          </span>

          <button onClick={() => updateUI({ showShare: true })} className="action-chip">
            <Share2 size={11} style={{ color: 'var(--accent)' }} />
            {t('analysis.share', lang)}
          </button>

          {user && (
            <button onClick={startCollab} disabled={collabLoading} className="action-chip"
              style={{ opacity: collabLoading ? 0.6 : undefined }}>
              {collabLoading
                ? <Loader2 size={11} className="animate-spin" />
                : <Users size={11} style={{ color: '#9B7AE8' }} />}
              {lang === 'tr' ? 'İşbirliği' : 'Collaborate'}
            </button>
          )}

          <PdfExport result={result} imageDataUrl={image} lang={lang} />
        </div>

        {/* Title */}
        <h1 className="report-artifact-title" style={{ marginBottom: '1rem' }}>
          {result.title}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            <MapPin size={14} style={{ color: 'var(--accent)' }} />
            {result.origin?.region || result.location}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-secondary)', flexShrink: 0 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            <HistoryIcon size={14} style={{ color: 'var(--accent)' }} />
            {result.dating?.period}
          </span>
        </div>

        <AudioGuideCard result={result} lang={lang} />
      </div>

      {/* ── Tabs ── */}
      <div>
        <div className="report-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`report-tab-btn${(activeTab as string) === tab.key ? ' active' : ''}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: 400, paddingTop: '2rem' }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};
