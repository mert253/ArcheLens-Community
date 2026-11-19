import React, { Suspense, lazy } from 'react';
import { Compass } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

const DiscoverGlobe = lazy(() => import('../../components/DiscoverGlobe').then(m => ({ default: m.DiscoverGlobe })));

export const DiscoverApp: React.FC = () => {
  const { lang, setAppMode } = useUIStore();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <nav className="fixed w-full z-50 glass-panel border-b border-[var(--border-primary)]">
        <div className="max-w-[1800px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Compass className="w-8 h-8 text-[var(--accent)]" />
            <span className="text-2xl font-bold font-serif tracking-widest">{lang === 'tr' ? 'Keşfet' : 'Discover'}</span>
          </div>
          <button 
            onClick={() => setAppMode('main')} 
            className="px-8 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-full text-xs font-bold uppercase tracking-widest hover:shadow-lg transition-all"
          >
            ← {lang === 'tr' ? 'Ana Sayfa' : 'Home'}
          </button>
        </div>
      </nav>
      <main className="pt-28 pb-10 px-4 sm:px-8 max-w-[1800px] mx-auto min-h-screen">
        <div className="glass-panel rounded-[2.5rem] border border-[var(--border-primary)] shadow-2xl overflow-hidden h-[calc(100vh-10rem)]">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Compass className="w-16 h-16 text-[var(--accent)] animate-spin-slow mx-auto mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                  {lang === 'tr' ? '3D Küre yükleniyor...' : 'Loading 3D Globe...'}
                </p>
              </div>
            </div>
          }>
            <DiscoverGlobe />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default DiscoverApp;
