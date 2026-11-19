import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMuseum } from '../useMuseum';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

const museumRow = {
  id: 'museum-1', owner_id: 'owner-1', name: 'Museum', description: '',
  is_public: true, created_at: '2026-01-01',
};

function mockUpdate(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response);
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  vi.mocked(supabase.from).mockReturnValue({ update } as any);
  return { update, eq };
}

describe('museum publication and failed mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the confirmed museum publication state without modifying room flags', async () => {
    const mocks = mockUpdate({ data: museumRow, error: null });
    const { result } = renderHook(useMuseum);
    let saved: any;
    await act(async () => { saved = await result.current.updateMuseum('museum-1', { isPublic: true }); });
    expect(supabase.from).toHaveBeenCalledWith('museums');
    expect(mocks.update).toHaveBeenCalledWith({ is_public: true });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'museum-1');
    expect(saved.isPublic).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not report publication success when RLS rejects the update', async () => {
    mockUpdate({ data: null, error: { message: 'Publication denied' } });
    const { result } = renderHook(useMuseum);
    let saved: any;
    await act(async () => { saved = await result.current.updateMuseum('museum-1', { isPublic: true }); });
    expect(saved).toBeNull();
    expect(result.current.error).toBe('Publication denied');
    expect(result.current.loading).toBe(false);
  });

  it('requires a returned museum row before acknowledging publication', async () => {
    mockUpdate({ data: null, error: null });
    const { result } = renderHook(useMuseum);
    await act(async () => { expect(await result.current.updateMuseum('museum-1', { isPublic: true })).toBeNull(); });
    expect(result.current.error).toBe('Museum update was not permitted.');
  });

  it('returns a rejected room update as an error instead of a new publication state', async () => {
    mockUpdate({ data: null, error: { message: 'Room access revoked' } });
    const { result } = renderHook(useMuseum);
    await act(async () => { expect(await result.current.updateRoom('room-1', { isPublic: true })).toBeNull(); });
    expect(result.current.error).toBe('Room access revoked');
  });

  it.each([
    [{ message: 'Delete denied' }, null, 'Delete denied'],
    [null, 0, 'Museum was not deleted. Refresh and check your access.'],
  ])('does not acknowledge a failed or zero-row delete', async (error, count, expected) => {
    const eq = vi.fn().mockResolvedValue({ error, count });
    vi.mocked(supabase.from).mockReturnValue({ delete: vi.fn().mockReturnValue({ eq }) } as any);
    const { result } = renderHook(useMuseum);
    await act(async () => { expect(await result.current.deleteMuseum('museum-1')).toBeNull(); });
    expect(result.current.error).toBe(expected);
  });

  it('exposes a museum read failure for the UI instead of silently treating it as an empty account', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database unavailable' } });
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }) } as any);
    const { result } = renderHook(useMuseum);
    await act(async () => { expect(await result.current.getMyMuseums('owner-1')).toEqual([]); });
    expect(result.current.error).toBe('Database unavailable');
  });
});
