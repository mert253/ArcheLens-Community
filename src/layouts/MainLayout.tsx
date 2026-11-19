import React, { useState } from 'react';
import {
  Home, Compass, Brain, Puzzle, Camera, Building2,
  History as HistoryIcon, HelpCircle, Settings, Moon, Sun, RefreshCcw,
  Layers, LogIn, LogOut
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { t, getLanguages } from '../i18n';
import { useHistory } from '../hooks/useHistory';
import { Language } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { artifactImageState } from '../lib/artifactImage';
import { HelpModal } from '../components/HelpModal';
import { HistoryPanel } from '../components/HistoryPanel';
import { ShareModal } from '../components/ShareModal';

interface MainLayoutProps {
  children: React.ReactNode;
}

// ArcheLens logo icon
const ArcheLensIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5Z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { image, result, resetApp, updateState, user, signInWithGoogle, signOut } = useAppStore();
  const [authError, setAuthError] = useState('');
  const {
    lang, theme, showHelp, showHistory: showHistoryPanel,
    showShare, setLang, toggleTheme, setAppMode, setShowHelp, setShowHistory,
    setShowShare, appMode
  } = useUIStore();

  const history = useHistory();
  const [expanded, setExpanded] = useState(false);

  const handleHistoryLoad = (entry: any) => {
    updateState({
      ...artifactImageState(entry.imageDataUrl),
      restoredImage: entry.restoredImageUrl || null,
      result: entry.result,
      ...(entry.restoredImageUrl && { restoredImage: entry.restoredImageUrl })
    });
    setAppMode('main');
    setShowHistory(false);
  };

  const navItems = [
    {
      icon: Home,
      label: lang === 'tr' ? 'Ana Sayfa' : 'Home',
      mode: 'main',
      action: () => resetApp(),
    },
    {
      icon: Compass,
      label: lang === 'tr' ? 'Keşfet' : 'Discover',
      mode: 'discover',
      action: () => setAppMode('discover'),
    },
    {
      icon: Brain,
      label: lang === 'tr' ? 'Detektif' : 'Detective',
      mode: 'detective',
      action: () => setAppMode('detective'),
    },
    {
      icon: Puzzle,
      label: lang === 'tr' ? 'Jigsaw' : 'Jigsaw',
      mode: 'match',
      action: () => setAppMode('match'),
    },
    {
      icon: Camera,
      label: lang === 'tr' ? '3D Tarama' : '3D Scan',
      mode: 'photogrammetry',
      action: () => setAppMode('photogrammetry'),
    },
    {
      icon: Building2,
      label: lang === 'tr' ? 'Müze' : 'Museum',
      mode: 'museum-edit',
      action: () => setAppMode('museum-edit' as any),
    },
    {
      icon: HistoryIcon,
      label: lang === 'tr' ? 'Geçmiş' : 'History',
      mode: null,
      action: () => setShowHistory(true),
      badge: history.entries.length > 0 ? history.entries.length : undefined,
    },
  ];

  const isActive = (mode: string | null) => {
    if (mode === 'main') return appMode === 'main';
    if (!mode) return false;
    return appMode === mode || appMode === (mode as string).replace('-edit', '');
  };

  return (
    <div className="app-shell">
      {/* ── Modals ── */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} lang={lang} />
      <HistoryPanel
        entries={history.entries}
        isOpen={showHistoryPanel}
        onClose={() => setShowHistory(false)}
        onLoad={handleHistoryLoad}
        onClear={history.clearAll}
        lang={lang}
      />
      {result && (
        <ShareModal
          result={result}
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          lang={lang}
          onDownloadPdf={() => {}}
        />
      )}

      {/* ── Sidebar (desktop) ── */}
      <aside
        className={`app-sidebar${expanded ? ' app-sidebar-expanded' : ''}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div className="sidebar-logo" onClick={resetApp} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && resetApp()}>
          <div className="sidebar-logo-icon">
            <ArcheLensIcon />
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">ArcheLens</span>
            <span className="sidebar-logo-sub">OPEN SOURCE</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav-scroll" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.mode ?? item.label}
              onClick={item.action}
              className={`sidebar-nav-item${isActive(item.mode) ? ' active' : ''}`}
              title={!expanded ? item.label : undefined}
            >
              <item.icon className="sidebar-nav-icon" />
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge !== undefined && (
                <span className="sidebar-badge">{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </button>
          ))}

          {image && (
            <>
              <div className="sidebar-divider" />
              <button
                onClick={resetApp}
                className="sidebar-nav-item"
                title={!expanded ? t('nav.newAnalysis', lang) : undefined}
              >
                <RefreshCcw className="sidebar-nav-icon" style={{ color: 'var(--accent)' }} />
                <span className="sidebar-nav-label" style={{ color: 'var(--accent)' }}>
                  {t('nav.newAnalysis', lang)}
                </span>
              </button>
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="sidebar-bottom">
          {isSupabaseConfigured && (
            <div>
              <button
                onClick={() => {
                  setAuthError('');
                  (user ? signOut() : signInWithGoogle()).catch(() =>
                    setAuthError(lang === 'tr' ? 'Giriş işlemi başarısız.' : 'Sign-in failed.')
                  );
                }}
                className="sidebar-nav-item"
                title={!expanded ? (user ? (lang === 'tr' ? 'Çıkış' : 'Sign out') : (lang === 'tr' ? 'Google ile Giriş' : 'Sign in with Google')) : undefined}
              >
                {user ? <LogOut className="sidebar-nav-icon" /> : <LogIn className="sidebar-nav-icon" />}
                <span className="sidebar-nav-label">
                  {user ? (lang === 'tr' ? 'Çıkış' : 'Sign out') : (lang === 'tr' ? 'Google ile Giriş' : 'Sign in with Google')}
                </span>
              </button>
              {authError && <span role="alert" className="block px-3 text-[11px] text-red-500">{authError}</span>}
            </div>
          )}

          <button
            onClick={() => setShowHelp(true)}
            className="sidebar-nav-item"
            title={!expanded ? t('nav.howItWorks', lang) : undefined}
          >
            <HelpCircle className="sidebar-nav-icon" />
            <span className="sidebar-nav-label">{t('nav.howItWorks', lang)}</span>
          </button>

          <button
            onClick={() => setAppMode('settings')}
            className={`sidebar-nav-item${appMode === 'settings' ? ' active' : ''}`}
            title={!expanded ? (lang === 'tr' ? 'Ayarlar' : 'Settings') : undefined}
          >
            <Settings className="sidebar-nav-icon" />
            <span className="sidebar-nav-label">{lang === 'tr' ? 'Ayarlar' : 'Settings'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="sidebar-nav-item"
            title={!expanded ? (theme === 'dark' ? (lang === 'tr' ? 'Açık Mod' : 'Light') : (lang === 'tr' ? 'Koyu Mod' : 'Dark')) : undefined}
          >
            {theme === 'dark'
              ? <Sun className="sidebar-nav-icon" />
              : <Moon className="sidebar-nav-icon" />}
            <span className="sidebar-nav-label">
              {theme === 'dark' ? (lang === 'tr' ? 'Açık Mod' : 'Light Mode') : (lang === 'tr' ? 'Koyu Mod' : 'Dark Mode')}
            </span>
          </button>

          {/* Language selector */}
          <div className="sidebar-nav-item" style={{ cursor: 'default' }}>
            <Layers className="sidebar-nav-icon" style={{ color: 'var(--text-tertiary)' }} />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              onClick={(e) => e.stopPropagation()}
              className="sidebar-nav-label"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                width: '100%',
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {getLanguages().map(l => (
                <option key={l.code} value={l.code}
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {([
          { icon: Home, label: lang === 'tr' ? 'Ana' : 'Home', mode: 'main', action: () => resetApp() },
          { icon: Compass, label: lang === 'tr' ? 'Keşfet' : 'Discover', mode: 'discover', action: () => setAppMode('discover') },
          { icon: Brain, label: lang === 'tr' ? 'Detektif' : 'Detective', mode: 'detective', action: () => setAppMode('detective') },
          { icon: Building2, label: lang === 'tr' ? 'Müze' : 'Museum', mode: 'museum-edit', action: () => setAppMode('museum-edit' as any) },
          { icon: HistoryIcon, label: lang === 'tr' ? 'Geçmiş' : 'History', mode: null, action: () => setShowHistory(true) },
        ] as any[]).map((item) => (
          <button
            key={item.mode ?? item.label}
            onClick={item.action}
            className={`mobile-nav-btn${isActive(item.mode) ? ' active' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Main content ── */}
      <main className="app-main">
        <div className="app-main-inner">
          {children}
        </div>
        <footer className="relative z-10 text-center pb-6 text-xs text-[var(--text-secondary)]">
          ArcheLens Open Source · <a href="/third-party-licenses.txt" target="_blank" rel="noopener noreferrer" className="underline">Third-party licenses</a>
        </footer>
      </main>
    </div>
  );
};
