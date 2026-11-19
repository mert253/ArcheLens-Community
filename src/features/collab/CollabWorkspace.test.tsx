import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollabWorkspace } from './CollabWorkspace';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), auth: { signInWithOAuth: vi.fn() } } }));
vi.mock('../analysis/AnalysisView', () => ({ AnalysisView: () => <div>Private analysis</div> }));
vi.mock('../analysis/ReportPanel', () => ({ ReportPanel: () => <div>Private report</div> }));
vi.mock('./CollabOverlay', () => ({ CollabOverlay: () => <div>Collaboration tools</div> }));
const workspaceId = '11111111-1111-4111-8111-111111111111';
const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'first@example.test', user_metadata: {} } as any;
const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_metadata: {} } as any;
function query(data: unknown) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  vi.mocked(supabase.from).mockReturnValue({ select } as any);
  return single;
}
beforeEach(() => { vi.clearAllMocks(); useAppStore.setState({ user: null, authLoading: false, result: null, image: null, imageBase64: 'stale-private-bytes', imageMimeType: 'image/png' }); });
afterEach(cleanup);
describe('direct private workspace routes', () => {
  it('renders sign-in before mounting or querying the private workspace', async () => {
    query(null); render(<CollabWorkspace workspaceId={workspaceId} />);
    expect(await screen.findByRole('button', { name: /Google/ })).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(screen.queryByText(/Workspace not found|Çalışma alanı bulunamadı/)).not.toBeInTheDocument();
  });
  it('retries after sign-in and when the authenticated user changes', async () => {
    const single = query(null); render(<CollabWorkspace workspaceId={workspaceId} />);
    await act(async () => { useAppStore.setState({ user: userA }); });
    await waitFor(() => expect(single).toHaveBeenCalledTimes(1));
    await act(async () => { useAppStore.setState({ user: userB }); });
    await waitFor(() => expect(single).toHaveBeenCalledTimes(2));
  });
  it('rejects malformed stored analysis without leaving stale image bytes', async () => {
    query({ id: workspaceId, owner_id: userA.id, title: 'Broken', result_json: { title: {}, origin: null }, image_url: null, created_at: '2026-10-28T00:00:00Z' });
    useAppStore.setState({ user: userA }); render(<CollabWorkspace workspaceId={workspaceId} />);
    await waitFor(() => expect(screen.queryByText(/yükleniyor|Loading workspace/)).not.toBeInTheDocument());
    expect(screen.queryByText('Private analysis')).not.toBeInTheDocument();
    expect(useAppStore.getState().result).toBeNull();
    expect(useAppStore.getState().imageBase64).toBeNull();
  });
});
