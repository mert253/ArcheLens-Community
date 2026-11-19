import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMuseum } from '../useMuseum';
import { supabase } from '../../lib/supabase';
import type { AnalysisResult } from '../../types';

const museumReport: AnalysisResult = {
  title: 'Clay bowl', confidence_score: 90,
  origin: { region: 'Eastern Mediterranean', culture: 'Unknown' },
  dating: { period: 'Antiquity', date_range: 'Unknown', century: 'Unknown' },
  specs: { style: 'Plain', material: 'Clay', technique: 'Hand-formed', dimensions: '10 cm' },
  analysis: { description: 'A small bowl.', iconography: '', inscription: null },
  preservation: { condition: 'Fragmentary', damages: 'Missing rim' },
  fun_fact: '', curator_note: '',
};

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useMuseum hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading false and error null', () => {
    const { result } = renderHook(() => useMuseum());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── Museums ──────────────────────────────────────────────────────────────────
  it('getMyMuseums fetches and formats museums correctly', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: '1', owner_id: 'user1', name: 'Museum 1', description: 'desc', is_public: true, created_at: '2023-01-01' },
      ],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });

    const { result } = renderHook(() => useMuseum());

    let museums;
    await act(async () => {
      museums = await result.current.getMyMuseums('user1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museums');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('owner_id', 'user1');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });

    expect(museums).toEqual([
      { id: '1', ownerId: 'user1', name: 'Museum 1', description: 'desc', isPublic: true, createdAt: '2023-01-01' },
    ]);
  });

  it('createMuseum handles success correctly', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: '2', owner_id: 'user1', name: 'Museum 2', description: 'desc2', is_public: false, created_at: '2023-01-02' },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
    });

    const { result } = renderHook(() => useMuseum());

    let newMuseum;
    await act(async () => {
      newMuseum = await result.current.createMuseum('user1', 'Museum 2', 'desc2');
    });

    expect(supabase.from).toHaveBeenCalledWith('museums');
    expect(mockInsert).toHaveBeenCalledWith({ owner_id: 'user1', name: 'Museum 2', description: 'desc2' });

    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(newMuseum).toEqual({
      id: '2', ownerId: 'user1', name: 'Museum 2', description: 'desc2', isPublic: false, createdAt: '2023-01-02'
    });
  });

  it('createMuseum handles error correctly', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Supabase error'),
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
    });

    const { result } = renderHook(() => useMuseum());

    let newMuseum;
    await act(async () => {
      newMuseum = await result.current.createMuseum('user1', 'Museum 2');
    });

    expect(newMuseum).toBeNull();
    expect(result.current.error).toBe('Supabase error');
    expect(result.current.loading).toBe(false);
  });

  it('deleteMuseum deletes a museum correctly', async () => {
    const mockEq = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      delete: mockDelete,
    });

    const { result } = renderHook(() => useMuseum());

    await act(async () => {
      await result.current.deleteMuseum('museum1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museums');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'museum1');
    expect(result.current.error).toBeNull();
  });

  // ── Rooms ────────────────────────────────────────────────────────────────────
  it('getRooms fetches and formats rooms correctly', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'r1', museum_id: 'm1', name: 'Room 1', layout: { type: 'grid' }, is_public: true, created_at: '2023-01-01' },
      ],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });

    const { result } = renderHook(() => useMuseum());

    let rooms;
    await act(async () => {
      rooms = await result.current.getRooms('m1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_rooms');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('museum_id', 'm1');
    expect(mockOrder).toHaveBeenCalledWith('created_at');

    expect(rooms).toEqual([
      { id: 'r1', museumId: 'm1', name: 'Room 1', layout: { type: 'grid' }, isPublic: true, createdAt: '2023-01-01' },
    ]);
  });

  it('getRoom fetches a single room correctly', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'r1', museum_id: 'm1', name: 'Room 1', layout: { type: 'grid' }, is_public: true, created_at: '2023-01-01' },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });

    const { result } = renderHook(() => useMuseum());

    let room;
    await act(async () => {
      room = await result.current.getRoom('r1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_rooms');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('id', 'r1');

    expect(room).toEqual(
      { id: 'r1', museumId: 'm1', name: 'Room 1', layout: { type: 'grid' }, isPublic: true, createdAt: '2023-01-01' }
    );
  });

  it('createRoom handles success correctly', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'r2', museum_id: 'm1', name: 'Room 2', layout: { type: 'list' }, is_public: false, created_at: '2023-01-02' },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
    });

    const { result } = renderHook(() => useMuseum());

    let newRoom;
    await act(async () => {
      newRoom = await result.current.createRoom('m1', 'Room 2', { type: 'list' } as any);
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_rooms');
    expect(mockInsert).toHaveBeenCalledWith({ museum_id: 'm1', name: 'Room 2', layout: { type: 'list' } });

    expect(newRoom).toEqual({
      id: 'r2', museumId: 'm1', name: 'Room 2', layout: { type: 'list' }, isPublic: false, createdAt: '2023-01-02'
    });
  });

  it('updateRoom updates a room correctly', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'r1', museum_id: 'm1', name: 'Updated Room', layout: 'square', is_public: false, created_at: '2023-01-01' }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
    });

    const { result } = renderHook(() => useMuseum());

    await act(async () => {
      await result.current.updateRoom('r1', { name: 'Updated Room', isPublic: false });
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_rooms');
    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated Room', is_public: false });
    expect(mockEq).toHaveBeenCalledWith('id', 'r1');
  });

  it('deleteRoom deletes a room correctly', async () => {
    const mockEq = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      delete: mockDelete,
    });

    const { result } = renderHook(() => useMuseum());

    await act(async () => {
      await result.current.deleteRoom('r1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_rooms');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'r1');
  });

  // ── Artifacts ────────────────────────────────────────────────────────────────
  it('loads valid artifacts, tolerates older optional fields, and skips incomplete rows', async () => {
    const validArtifact = {
      id: 'a1', room_id: 'r1', artifact_id: 'art1', artifact_data: museumReport,
      artifact_image: 'img.jpg', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1,
    };
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        validArtifact,
        { ...validArtifact, id: 'a2', artifact_data: null },
        { ...validArtifact, id: 'a3', position: { x: 0, z: 0 } },
        {
          ...validArtifact,
          id: 'a4',
          artifact_data: {
            ...museumReport,
            title: '',
            confidence_score: 110,
            analysis: { ...museumReport.analysis, inscription: 'Unknown' },
            current_location: { museum: 'Local museum', city: '', country: '', coordinates: [] },
          },
        },
      ],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });

    const { result } = renderHook(() => useMuseum());

    let artifacts;
    await act(async () => {
      artifacts = await result.current.getRoomArtifacts('r1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_artifacts');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('room_id', 'r1');
    expect(mockOrder).toHaveBeenCalledWith('created_at');

    expect(artifacts).toEqual([
      { id: 'a1', roomId: 'r1', artifactId: 'art1', artifactData: museumReport, artifactImage: undefined, position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0}, scale: 1 },
      { id: 'a4', roomId: 'r1', artifactId: 'art1', artifactData: { ...museumReport, title: '—', confidence_score: 100 }, artifactImage: undefined, position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0}, scale: 1 },
    ]);
  });

  it('addArtifact handles success correctly', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a2', room_id: 'r1', artifact_id: 'art2', artifact_data: museumReport, artifact_image: null, position: {x:1, y:1, z:1}, rotation: {x:0, y:0, z:0}, scale: 1 },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
    });

    const { result } = renderHook(() => useMuseum());

    let newArtifact;
    await act(async () => {
      newArtifact = await result.current.addArtifact('r1', 'art2', museumReport, 'img2.jpg', {x:1, y:1, z:1});
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_artifacts');
    expect(mockInsert).toHaveBeenCalledWith({
      room_id: 'r1', artifact_id: 'art2', artifact_data: museumReport, artifact_image: null, position: {x:1, y:1, z:1}, rotation: {x:0, y:0, z:0}, scale: 1
    });

    expect(newArtifact).toEqual({
      id: 'a2', roomId: 'r1', artifactId: 'art2', artifactData: museumReport, artifactImage: undefined, position: {x:1, y:1, z:1}, rotation: {x:0, y:0, z:0}, scale: 1
    });
  });

  it('removeArtifact deletes an artifact correctly', async () => {
    const mockEq = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as any).mockReturnValue({
      delete: mockDelete,
    });

    const { result } = renderHook(() => useMuseum());

    await act(async () => {
      await result.current.removeArtifact('a1');
    });

    expect(supabase.from).toHaveBeenCalledWith('museum_artifacts');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'a1');
  });
});
