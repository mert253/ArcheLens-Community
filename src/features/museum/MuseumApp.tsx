import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';

const MuseumEditor = lazy(() => import('./MuseumEditor').then(m => ({ default: m.MuseumEditor })));
const MuseumViewer = lazy(() => import('./MuseumViewer').then(m => ({ default: m.MuseumViewer })));

const Spin = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
  </div>
);

export const MuseumApp: React.FC = () => {
  const { appMode, museumRoomId } = useUIStore();
  const authLoading = useAppStore(state => state.authLoading);
  const principal = useAppStore(state => state.user?.id || 'anonymous');

  if (authLoading) return <Spin />;

  if (appMode === 'museum' && museumRoomId) {
    return (
      <Suspense fallback={<Spin />}>
        <MuseumViewer key={`${principal}:${museumRoomId}`} roomId={museumRoomId} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Spin />}>
      <MuseumEditor key={principal} />
    </Suspense>
  );
};
