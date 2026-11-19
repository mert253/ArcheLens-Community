import { useState, useCallback } from 'react';
import { z } from 'zod';
import { storedAnalysisSchema } from '../features/collab/validation';
import { supabase } from '../lib/supabase';
import { normalizeStoredMuseumImage } from '../lib/museumImage';
import type { Museum, MuseumRoom, MuseumArtifactPlacement, RoomLayout, AnalysisResult } from '../types';

interface MuseumRow {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: string;
}

interface MuseumRoomRow {
  id: string;
  museum_id: string;
  name: string;
  layout: RoomLayout;
  is_public: boolean;
  created_at: string;
}

const transformNumber = z.number().finite().min(-10_000).max(10_000);
const transformVector = z.object({ x: transformNumber, y: transformNumber, z: transformNumber });
const analysisFields = storedAnalysisSchema.shape;
const museumAnalysisSchema = storedAnalysisSchema.extend({
  title: z.string().nullish(),
  confidence_score: z.number().finite(),
  analysis: analysisFields.analysis.extend({
    inscription: analysisFields.analysis.shape.inscription.catch(null),
  }),
  location: analysisFields.location.catch(undefined),
  groundingUrls: analysisFields.groundingUrls.catch(undefined),
  historical_context: analysisFields.historical_context.catch(undefined),
  cultural_significance: analysisFields.cultural_significance.catch(undefined),
  similar_artifacts: analysisFields.similar_artifacts.catch(undefined),
  production_technique_detail: analysisFields.production_technique_detail.catch(undefined),
  symbolism: analysisFields.symbolism.catch(undefined),
  coordinates: analysisFields.coordinates.catch(undefined),
  current_location: analysisFields.current_location.catch(undefined),
  bounding_boxes: analysisFields.bounding_boxes.catch(undefined),
  digital_reconstruction: analysisFields.digital_reconstruction.catch(undefined),
  inventory: analysisFields.inventory.catch(undefined),
});
const museumArtifactRow = z.object({
  id: z.string(),
  room_id: z.string(),
  artifact_id: z.string(),
  artifact_data: museumAnalysisSchema,
  artifact_image: z.unknown(),
  position: transformVector,
  rotation: transformVector,
  scale: z.number().finite().positive().max(100),
});

function rowToMuseum(d: MuseumRow): Museum {
  return { id: d.id, ownerId: d.owner_id, name: d.name, description: d.description || '', isPublic: d.is_public, createdAt: d.created_at };
}
function rowToRoom(d: MuseumRoomRow): MuseumRoom {
  return { id: d.id, museumId: d.museum_id, name: d.name, layout: d.layout, isPublic: d.is_public, createdAt: d.created_at };
}
function rowToArtifact(row: unknown, roomId: string): MuseumArtifactPlacement | null {
  const parsed = museumArtifactRow.safeParse(row);
  if (!parsed.success || parsed.data.room_id !== roomId) return null;
  const d = parsed.data;
  return {
    id: d.id, roomId: d.room_id, artifactId: d.artifact_id,
    artifactData: normalizeMuseumAnalysis(d.artifact_data),
    artifactImage: normalizeStoredMuseumImage(d.artifact_image) || undefined,
    position: d.position, rotation: d.rotation, scale: d.scale,
  };
}

function normalizeMuseumAnalysis(data: z.output<typeof museumAnalysisSchema>): AnalysisResult {
  return {
    ...data,
    title: data.title?.trim() ? data.title.slice(0, 500) : '—',
    confidence_score: Math.max(0, Math.min(100, data.confidence_score)),
    analysis: { ...data.analysis, inscription: data.analysis.inscription ?? null },
  } as AnalysisResult; // The parsed coordinate and bounding-box tuples have fixed lengths.
}

export function useMuseum() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const wrap = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true); setError(null);
    try { return await fn(); }
    catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : (typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string')
          ? (e as { message: string }).message
          : String(e);
      setError(msg || 'Unknown error');
      return null;
    }
    finally { setLoading(false); }
  }, []);

  // ── Museums ──────────────────────────────────────────────────────────────────
  const getMyMuseums = useCallback(async (userId: string): Promise<Museum[]> => {
    return await wrap(async () => {
      const { data, error: e } = await supabase.from('museums').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
      if (e) throw e;
      return (data || []).map(rowToMuseum);
    }) || [];
  }, [wrap]);

  const createMuseum = useCallback((userId: string, name: string, description = '') =>
    wrap(async () => {
      const { data, error: e } = await supabase.from('museums')
        .insert({ owner_id: userId, name, description }).select().single();
      if (e) throw e;
      return rowToMuseum(data);
    }), [wrap]);

  const updateMuseum = useCallback((id: string, updates: Partial<{ name: string; isPublic: boolean }>) =>
    wrap(async () => {
      const payload: { name?: string; is_public?: boolean } = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
      const { data, error: e } = await supabase.from('museums').update(payload).eq('id', id).select('*').single();
      if (e) throw e;
      if (!data) throw new Error('Museum update was not permitted.');
      return rowToMuseum(data);
    }), [wrap]);

  const deleteMuseum = useCallback((id: string) =>
    wrap(async () => {
      const { error: e, count } = await supabase.from('museums').delete({ count: 'exact' }).eq('id', id);
      if (e) throw e;
      if (count === 0) throw new Error('Museum was not deleted. Refresh and check your access.');
      return true;
    }), [wrap]);

  // ── Rooms ────────────────────────────────────────────────────────────────────
  const getRooms = useCallback(async (museumId: string): Promise<MuseumRoom[]> => {
    return await wrap(async () => {
      const { data, error: e } = await supabase.from('museum_rooms').select('*').eq('museum_id', museumId).order('created_at');
      if (e) throw e;
      return (data || []).map(rowToRoom);
    }) || [];
  }, [wrap]);

  const getRoom = useCallback(async (roomId: string): Promise<MuseumRoom | null> => {
    return await wrap(async () => {
      const { data, error: e } = await supabase.from('museum_rooms').select('*').eq('id', roomId).single();
      if (e) throw e;
      return data ? rowToRoom(data) : null;
    });
  }, [wrap]);

  const createRoom = useCallback((museumId: string, name: string, layout: RoomLayout) =>
    wrap(async () => {
      const { data, error: e } = await supabase.from('museum_rooms')
        .insert({ museum_id: museumId, name, layout }).select().single();
      if (e) throw e;
      return rowToRoom(data);
    }), [wrap]);

  const updateRoom = useCallback((id: string, updates: Partial<{ name: string; isPublic: boolean }>) =>
    wrap(async () => {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
      const { data, error: e } = await supabase.from('museum_rooms').update(payload).eq('id', id).select('*').single();
      if (e) throw e;
      if (!data) throw new Error('Room update was not permitted.');
      return rowToRoom(data);
    }), [wrap]);

  const deleteRoom = useCallback((id: string) =>
    wrap(async () => {
      const { error: e, count } = await supabase.from('museum_rooms').delete({ count: 'exact' }).eq('id', id);
      if (e) throw e;
      if (count === 0) throw new Error('Room was not deleted. Refresh and check your access.');
      return true;
    }), [wrap]);

  // ── Artifacts ────────────────────────────────────────────────────────────────
  const getRoomArtifacts = useCallback(async (roomId: string): Promise<MuseumArtifactPlacement[]> => {
    return await wrap(async () => {
      const { data, error: e } = await supabase.from('museum_artifacts').select('*').eq('room_id', roomId).order('created_at');
      if (e) throw e;
      return (data || []).map(row => rowToArtifact(row, roomId)).filter(row => row !== null);
    }) || [];
  }, [wrap]);

  const addArtifact = useCallback((
    roomId: string, artifactId: string, artifactData: AnalysisResult, artifactImage: string | undefined,
    position: { x: number; y: number; z: number },
  ) =>
    wrap(async () => {
      const validated = museumAnalysisSchema.safeParse(artifactData);
      const placement = transformVector.safeParse(position);
      if (!validated.success || !placement.success) throw new Error('The artifact report or placement is invalid.');
      const { data, error: e } = await supabase.from('museum_artifacts')
        .insert({ room_id: roomId, artifact_id: artifactId, artifact_data: normalizeMuseumAnalysis(validated.data), artifact_image: normalizeStoredMuseumImage(artifactImage), position: placement.data, rotation: { x: 0, y: 0, z: 0 }, scale: 1 })
        .select().single();
      if (e) throw e;
      const artifact = rowToArtifact(data, roomId);
      if (!artifact) throw new Error('The saved artifact response was invalid.');
      return artifact;
    }), [wrap]);

  const removeArtifact = useCallback((id: string) =>
    wrap(async () => {
      const { error: e, count } = await supabase.from('museum_artifacts').delete({ count: 'exact' }).eq('id', id);
      if (e) throw e;
      if (count === 0) throw new Error('Artifact was not removed. Refresh and check your access.');
      return true;
    }), [wrap]);

  return {
    loading, error,
    getMyMuseums, createMuseum, updateMuseum, deleteMuseum,
    getRooms, getRoom, createRoom, updateRoom, deleteRoom,
    getRoomArtifacts, addArtifact, removeArtifact,
  };
}
