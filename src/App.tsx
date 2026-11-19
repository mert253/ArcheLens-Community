import React, { Suspense, lazy, useRef, useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { useUIStore } from './store/useUIStore';
import { useAnalyzeArtifact, useCompareArtifacts } from './hooks/useArtifacts';
import { useHistory } from './hooks/useHistory';
import { useAIMode } from './hooks/useAIMode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './layouts/MainLayout';
import { UploadScreen } from './components/UploadScreen';
import { AnalysisView } from './features/analysis/AnalysisView';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoadingPlaceholder } from './components/Common/LoadingPlaceholder';
import { SetupScreen } from './components/SetupScreen';
import { SettingsScreen } from './components/SettingsScreen';

// Lazy load feature modules
const DiscoverApp       = lazy(() => import('./features/discover/DiscoverApp'));
const DetectiveMode     = lazy(() => import('./components/DetectiveMode').then(m => ({ default: m.DetectiveMode })));
const MatchApp          = lazy(() => import('./features/match/MatchApp'));
const PhotogrammetryApp = lazy(() => import('./features/photogrammetry/PhotogrammetryApp'));
const CollabWorkspace   = lazy(() => import('./features/collab/CollabWorkspace').then(m => ({ default: m.CollabWorkspace })));
const MuseumApp         = lazy(() => import('./features/museum/MuseumApp').then(m => ({ default: m.MuseumApp })));

import { API_BASE } from './lib/config';

// ─── Main app (rendered only after setup is confirmed) ───────────────────────
function MainApp() {
  const { image, updateState, revokeUrls } = useAppStore();
  const { appMode, lang, workspaceId } = useUIStore();
  const history = useHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useAIMode(); // start auto-detection of connectivity at app root

  const analyzeMutation = useAnalyzeArtifact();
  const compareMutation = useCompareArtifacts();

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      revokeUrls();
      const url = URL.createObjectURL(file);
      updateState({ image: url, result: null, error: null });
      analyzeMutation.mutate(
        { file, lang },
        { onSuccess: (res) => history.addEntry(url, res) }
      );
    }
  };

  const handleUrlAnalyze = async (url: string) => {
    try {
      const { updateUI } = useUIStore.getState();
      updateState({ error: null, result: null, restoredImage: null });
      updateUI({ activeTab: 'overview' });
      useAppStore.getState().addLog('info', `Fetching from URL: ${url}`);

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image from URL');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('URL does not point to a valid image');

      const file = new File([blob], 'url-image.' + blob.type.split('/')[1], { type: blob.type });
      revokeUrls();
      updateState({ image: URL.createObjectURL(file), result: null, error: null });

      analyzeMutation.mutate(
        { file, lang },
        { onSuccess: (res) => history.addEntry(url, res) }
      );
    } catch (err: unknown) {
      updateState({ error: err instanceof Error ? err.message : String(err) });
    }
  };

  if (appMode === 'settings') {
    return (
      <ErrorBoundary>
        <MainLayout>
          <SettingsScreen />
        </MainLayout>
      </ErrorBoundary>
    );
  }

  if (appMode === 'match') {
    return (
      <ErrorBoundary>
        <MainLayout>
          <Suspense fallback={<LoadingPlaceholder lang={lang} />}>
            <MatchApp />
          </Suspense>
        </MainLayout>
      </ErrorBoundary>
    );
  }

  if (appMode === 'photogrammetry') {
    return (
      <ErrorBoundary>
        <MainLayout>
          <Suspense fallback={<LoadingPlaceholder lang={lang} />}>
            <PhotogrammetryApp />
          </Suspense>
        </MainLayout>
      </ErrorBoundary>
    );
  }

  if (appMode === 'workspace') {
    return (
      <ErrorBoundary>
        <MainLayout>
          <Suspense fallback={<LoadingPlaceholder lang={lang} />}>
            <CollabWorkspace workspaceId={workspaceId || ''} />
          </Suspense>
        </MainLayout>
      </ErrorBoundary>
    );
  }

  if (appMode === 'museum' || appMode === 'museum-edit') {
    return (
      <ErrorBoundary>
        <MainLayout>
          <Suspense fallback={<LoadingPlaceholder lang={lang} />}>
            <MuseumApp />
          </Suspense>
        </MainLayout>
      </ErrorBoundary>
    );
  }

  if (appMode === 'discover') {
    return (
      <Suspense fallback={<LoadingPlaceholder lang={lang} />}>
        <DiscoverApp />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary>
      <MainLayout>
        {appMode === 'detective' ? (
          <Suspense fallback={<LoadingPlaceholder lang={lang} />}>
            <DetectiveMode />
          </Suspense>
        ) : (
          <>
            {!image ? (
              <UploadScreen
                fileInputRef={fileInputRef as any}
                onFileChange={onFileChange}
                onMultiFileChange={() => {}}
                onCompareChange={(files) => compareMutation.mutate(files)}
                onUrlAnalyze={handleUrlAnalyze}
                lang={lang}
              />
            ) : (
              <ProtectedRoute>
                <AnalysisView />
              </ProtectedRoute>
            )}
          </>
        )}
      </MainLayout>
    </ErrorBoundary>
  );
}

// ─── Root: setup gate ─────────────────────────────────────────────────────────


export default function ArcheLensOpenSource() {
  const { updateUI } = useUIStore();
  const [setupChecked, setSetupChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // URL-based routing for shared workspace and museum links
  useEffect(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/workspace\/([^/]+)/);
    if (m) {
      updateUI({ appMode: 'workspace', workspaceId: m[1] });
      return;
    }
    const mMuseumView = path.match(/^\/museum\/([^/]+)/);
    if (mMuseumView && mMuseumView[1] !== 'edit') {
      updateUI({ appMode: 'museum', museumRoomId: mMuseumView[1] });
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Non-Electron: check via HTTP
    const check = () =>
      fetch(`${API_BASE}/setup/status`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) {
            setNeedsSetup(!data.configured);
            setSetupChecked(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            // Sunucu henüz hazır olmayabilir — 2 saniye sonra tekrar dene
            setTimeout(() => {
              fetch(`${API_BASE}/setup/status`)
                .then((r) => r.json())
                .then((data) => {
                  if (!cancelled) {
                    setNeedsSetup(!data.configured);
                    setSetupChecked(true);
                  }
                })
                .catch(() => { if (!cancelled) setSetupChecked(true); });
            }, 2000);
          }
        });

    check();
    return () => { cancelled = true; };
  }, []);

  if (!setupChecked) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0A0A0D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(201,150,74,0.25)', borderTopColor: '#C9964A', borderRadius: '50%' }} className="animate-spin" />
      </div>
    );
  }

  if (needsSetup) {
    return <SetupScreen onSetupComplete={() => setNeedsSetup(false)} />;
  }

  return <MainApp />;
}
