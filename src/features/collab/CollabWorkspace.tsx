import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { artifactImageState } from '../../lib/artifactImage';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { AnalysisView } from '../analysis/AnalysisView';
import { ReportPanel } from '../analysis/ReportPanel';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { CollabOverlay } from './CollabOverlay';
import type { AnalysisWorkspace } from '../../types';
import { peerDisplayName, parseStoredAnalysis, uuidSchema, workspaceRowSchema } from './validation';

interface Props {
  workspaceId: string;
}

export const CollabWorkspace: React.FC<Props> = ({ workspaceId }) => {
  const { user, updateState } = useAppStore();
  useEffect(() => {
    if (!user) updateState({ result: null, ...artifactImageState(null), restoredImage: null });
  }, [user?.id, updateState]);
  return <ProtectedRoute><WorkspaceContent key={`${workspaceId}:${user?.id || 'signed-out'}`} workspaceId={workspaceId} /></ProtectedRoute>;
};

const WorkspaceContent: React.FC<Props> = ({ workspaceId }) => {
  const { user, updateState } = useAppStore();
  const { lang } = useUIStore();
  const tr = lang === 'tr';
  const [ws, setWs]       = useState<AnalysisWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setWs(null);
    updateState({ result: null, ...artifactImageState(null), restoredImage: null, epigraphyImage: null, epigraphyDetections: [], cvOverlayDataUrl: null, cvRegionMapDataUrl: null });
    if (!isSupabaseConfigured || !user || !uuidSchema.safeParse(workspaceId).success) {
      setError('unavailable'); setLoading(false); return;
    }
    Promise.resolve(supabase
      .from('analysis_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single())
      .then(({ data, error: err }) => {
        if (cancelled) return;
        const parsed = workspaceRowSchema.safeParse(data);
        if (err || !parsed.success || parsed.data.id !== workspaceId) {
          setError('unavailable');
        } else {
          const data = parsed.data;
          // Stored photos never inherit bytes from the last artifact opened on this device.
          const photo = artifactImageState(data.image_url || null);
          const w: AnalysisWorkspace = {
            id: data.id, ownerId: data.owner_id, title: data.title,
            resultJson: data.result_json as AnalysisWorkspace['resultJson'], imageUrl: photo.image || undefined, createdAt: data.created_at,
          };
          setWs(w);
          updateState({ result: w.resultJson, ...photo });
        }
        setLoading(false);
      }).catch(() => { if (!cancelled) { setError('unavailable'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [workspaceId, user?.id, updateState]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-sm text-stone-400 font-medium">{tr ? 'Çalışma alanı yükleniyor...' : 'Loading workspace...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <span className="text-sm text-red-300">{!isSupabaseConfigured ? (tr ? 'İşbirliği için Supabase kurulumu gerekli.' : 'Configure Supabase to use collaboration.') : (tr ? 'Çalışma alanı bulunamadı veya erişiminiz yok.' : 'Workspace not found or access unavailable.')}</span>
      </div>
    );
  }

  if (!user) return null;
  const userId = user.id;
  const userName = peerDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0], tr ? 'Katılımcı' : 'Participant');

  return (
      <div className="relative">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Users size={16} className="text-amber-400" />
          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
            {tr ? 'Canlı İşbirliği Oturumu' : 'Live Collaboration Session'}
          </span>
          <span className="text-[10px] text-stone-600">— {ws?.title}</span>
        </div>
        {ws?.imageUrl ? <AnalysisView /> : <ReportPanel />}
        <CollabOverlay
          analysisId={workspaceId}
          userId={userId}
          userName={userName}
          lang={lang}
        />
      </div>
  );
};

// ─── Create workspace from current analysis ────────────────────────────────────
export async function createWorkspace(
  userId: string,
  title: string,
  resultJson: any,
  imageUrl?: string,
): Promise<string | null> {
  const result = parseStoredAnalysis(resultJson);
  if (!isSupabaseConfigured || !uuidSchema.safeParse(userId).success || !result || typeof title !== 'string' || title.length > 500) return null;
  const photo = artifactImageState(imageUrl || null);
  // Object URLs are private to one browser session and cannot be shared durably.
  const durablePhoto = photo.imageBase64 ? photo.image : null;
  const { data, error } = await supabase
    .from('analysis_workspaces')
    .insert({ owner_id: userId, title, result_json: result, image_url: durablePhoto })
    .select('id')
    .single();
  if (error || !data || !uuidSchema.safeParse(data.id).success) return null;
  return data.id;
}
