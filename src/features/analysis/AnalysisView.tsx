import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useIsMutating, useMutationState } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { ArtifactViewer } from './ArtifactViewer';
import { RestorationPanel } from './RestorationPanel';
import { ReportPanel } from './ReportPanel';
import { AIModeToggle } from '../../components/AIModeToggle';
import { useAIMode } from '../../hooks/useAIMode';

export const AnalysisView: React.FC = () => {
  const { image, result } = useAppStore();
  const isAnalyzing = useIsMutating({ mutationKey: ['analyze'] }) > 0;
  useAIMode(); // ensure auto-detect runs while analysis view is mounted
  const parseErrors = useMutationState({
    filters: { mutationKey: ['analyze'], status: 'error' },
    select: (mutation) => (mutation.state.error as Error)?.message
  });
  const error = parseErrors.length > 0 ? parseErrors[parseErrors.length - 1] : null;

  if (!image) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* LEFT PANEL */}
      <div className="w-full lg:w-5/12 lg:sticky animate-fade-in z-20" style={{ top: '1.5rem' }}>
        <ArtifactViewer />
        <RestorationPanel />
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-7/12 pb-20 animate-slide-up-slow">
        {/* AI mode badge */}
        <div className="flex justify-end mb-4">
          <AIModeToggle />
        </div>
        {error && (
          <div style={{
            marginBottom: '1.5rem', padding: '1rem 1.25rem',
            background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #ef4444',
            borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <AlertCircle style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>{error}</span>
          </div>
        )}
        {result && !isAnalyzing && <ReportPanel />}
      </div>
    </div>
  );
};
