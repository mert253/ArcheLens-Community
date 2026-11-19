import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollaboration } from '../../hooks/useCollaboration';
const mock = vi.hoisted(() => ({ handlers: {} as Record<string, (event?: unknown) => any>, presence: {} as unknown, from: vi.fn(), send: vi.fn().mockResolvedValue('ok'), removeChannel: vi.fn().mockResolvedValue('ok') }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  from: mock.from, removeChannel: mock.removeChannel,
  channel: vi.fn(() => ({
    on(kind: string, filter: { event: string }, callback: (event?: unknown) => any) { mock.handlers[`${kind}:${filter.event}`] = callback; return this; },
    subscribe() { return this; }, presenceState: () => mock.presence, send: mock.send, track: vi.fn().mockResolvedValue('ok'),
  })),
} }));
const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const peerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const annotationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function options() { return { analysisId: workspaceId, userId, userName: 'Local', userColor: '#abcdef', onRemoteCursor: vi.fn(), onRemoteLeave: vi.fn(), onDrawEvent: vi.fn(), onAnnotation: vi.fn() }; }
const cursor = { userId: peerId, name: 'Peer', color: '#aabbcc', cursorX: 0.5, cursorY: 0.5 };
beforeEach(() => { vi.clearAllMocks(); mock.handlers = {}; mock.presence = {}; });
afterEach(cleanup);
describe('realtime boundary', () => {
  it('ignores malformed presence/cursor/path messages and strips forged event types', () => {
    const callbacks = options(); const { result } = renderHook(() => useCollaboration(callbacks));
    act(() => {
      mock.handlers['presence:join']({ newPresences: [{ ...cursor, name: {} }] });
      mock.handlers['broadcast:cursor_move']({ payload: { ...cursor, cursorX: Infinity } });
      mock.handlers['broadcast:cursor_move'](null);
      mock.handlers['broadcast:draw_end']({ payload: { userId: peerId, color: '#abcdef', width: 3, path: Array.from({ length: 1025 }, () => ({ x: 0, y: 0 })) } });
      mock.handlers['broadcast:draw_start']({ payload: { userId: peerId, color: '#abcdef', width: 3, point: null } });
    });
    expect(result.current.presenceUsers).toEqual([]); expect(callbacks.onRemoteCursor).not.toHaveBeenCalled(); expect(callbacks.onDrawEvent).not.toHaveBeenCalled();
    act(() => mock.handlers['broadcast:draw_point']({ payload: { type: 'draw_end', userId: peerId, point: { x: 0.2, y: 0.4 } } }));
    expect(callbacks.onDrawEvent).toHaveBeenCalledWith({ type: 'draw_point', userId: peerId, point: { x: 0.2, y: 0.4 } });
  });
  it('caps presence collections and per-channel cursor floods', () => {
    const callbacks = options(); const { result } = renderHook(() => useCollaboration(callbacks));
    mock.presence = { peers: Array.from({ length: 200 }, (_, index) => ({ ...cursor, userId: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111` })) };
    act(() => {
      mock.handlers['presence:sync']();
      for (let i = 0; i < 200; i++) mock.handlers['broadcast:cursor_move']({ payload: cursor });
    });
    expect(result.current.presenceUsers.length).toBeLessThanOrEqual(32); expect(callbacks.onRemoteCursor.mock.calls.length).toBeLessThanOrEqual(40);
  });
  it('reloads annotation data from authorized rows instead of trusting peer metadata', async () => {
    const callbacks = options(); renderHook(() => useCollaboration(callbacks));
    const row = { id: annotationId, workspace_id: workspaceId, user_id: peerId, user_name: 'Stored author', user_color: '#aabbcc', created_at: '2026-10-28T00:00:00Z', type: 'draw', data: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], width: 3 } };
    const query = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) };
    mock.from.mockReturnValue({ select: () => query });
    await act(async () => { await mock.handlers['broadcast:annotation_add']({ payload: { annotation: { id: annotationId, userName: 'Forged author', data: { points: [null] } } } }); });
    expect(callbacks.onAnnotation).toHaveBeenCalledWith(expect.objectContaining({ annotation: expect.objectContaining({ userName: 'Stored author', userId: peerId }) }));
    expect(query.eq).toHaveBeenCalledWith('workspace_id', workspaceId);
  });
  it('only broadcasts a deletion after the database confirms an owned row deletion', async () => {
    const { result } = renderHook(() => useCollaboration(options()));
    const query = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    mock.from.mockReturnValue({ delete: () => query });
    await act(async () => { await result.current.deleteAnnotation(annotationId); });
    expect(mock.send).not.toHaveBeenCalled();
    query.select.mockResolvedValueOnce({ data: [{ id: annotationId }], error: null });
    await act(async () => { await result.current.deleteAnnotation(annotationId); });
    expect(query.eq).toHaveBeenCalledWith('user_id', userId);
    expect(mock.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'annotation_delete', payload: { id: annotationId } });
  });
});
