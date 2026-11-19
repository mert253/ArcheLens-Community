import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CollabUser, DrawPoint, StoredAnnotation } from '../types';
import {
  annotationAddPayloadSchema, annotationIdPayloadSchema, annotationInputSchema,
  colorSchema, createEventBudget, cursorPayloadSchema, drawPayloadSchemas,
  MAX_ANNOTATIONS, MAX_PEERS, parseAnnotationRow, peerDisplayName,
  presenceJoinSchema, presenceLeaveSchema, uuidSchema,
} from '../features/collab/validation';

export type DrawBroadcast =
  | { type: 'draw_start'; userId: string; color: string; width: number; point: DrawPoint }
  | { type: 'draw_point'; userId: string; point: DrawPoint }
  | { type: 'draw_end'; userId: string; color: string; width: number; path: DrawPoint[] };
export type AnnotationBroadcast =
  | { type: 'annotation_add'; annotation: StoredAnnotation }
  | { type: 'annotation_delete'; id: string };
interface Options {
  analysisId: string; userId: string; userName: string; userColor: string;
  onRemoteCursor: (user: CollabUser) => void;
  onRemoteLeave: (userId: string) => void;
  onDrawEvent: (event: DrawBroadcast) => void;
  onAnnotation: (event: AnnotationBroadcast) => void;
}
const COLORS = ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
export function pickColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}
function payloadOf(event: unknown): unknown {
  return event && typeof event === 'object' ? (event as { payload?: unknown }).payload : undefined;
}
function collectPresence(value: unknown, ownId: string): CollabUser[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const peers = new Map<string, CollabUser>(); let inspected = 0, keys = 0;
  for (const key in value) {
    if (++keys > MAX_PEERS * 4) break;
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const rows = (value as Record<string, unknown>)[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows.slice(0, MAX_PEERS)) {
      if (++inspected > MAX_PEERS * 4) return [...peers.values()];
      const parsed = cursorPayloadSchema.safeParse(row);
      if (parsed.success && parsed.data.userId !== ownId) peers.set(parsed.data.userId, parsed.data);
      if (peers.size === MAX_PEERS) return [...peers.values()];
    }
  }
  return [...peers.values()];
}

export function useCollaboration(options: Options) {
  const { analysisId, userId, userName, userColor } = options;
  const callbacks = useRef(options); callbacks.current = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000), generation = useRef(0);
  const lastCursor = useRef(0), lastPoint = useRef(0);
  const [connected, setConnected] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<CollabUser[]>([]);
  const name = peerDisplayName(userName);
  const color = colorSchema.safeParse(userColor).success ? userColor : pickColor(userId);
  const usable = isSupabaseConfigured && uuidSchema.safeParse(analysisId).success && uuidSchema.safeParse(userId).success;
  const connect = useCallback(() => {
    const current = ++generation.current;
    if (channelRef.current) void Promise.resolve(supabase.removeChannel(channelRef.current)).catch(() => {});
    channelRef.current = null; setConnected(false); setPresenceUsers([]);
    if (!usable) return;
    const channel = supabase.channel(`analysis:${analysisId}`, { config: { private: true, presence: { key: userId } } });
    const active = () => generation.current === current;
    const cursorBudget = createEventBudget(40), drawBudget = createEventBudget(90), boundaryBudget = createEventBudget(20);
    const presenceBudget = createEventBudget(8), annotationBudget = createEventBudget(4);
    let pendingRefreshes = 0;
    // Peer IDs/names are display claims. Only database rows establish persistent authorship.
    channel.on('presence', { event: 'sync' }, () => {
      if (active() && presenceBudget()) setPresenceUsers(collectPresence(channel.presenceState(), userId));
    }).on('presence', { event: 'join' }, (event: unknown) => {
      if (!active() || !presenceBudget()) return;
      const parsed = presenceJoinSchema.safeParse(event); if (!parsed.success) return;
      setPresenceUsers(previous => {
        const peers = new Map(previous.map(peer => [peer.userId, peer]));
        for (const peer of parsed.data.newPresences) if (peer.userId !== userId) peers.set(peer.userId, peer);
        return [...peers.values()].slice(-MAX_PEERS);
      });
    }).on('presence', { event: 'leave' }, (event: unknown) => {
      if (!active() || !presenceBudget()) return;
      const parsed = presenceLeaveSchema.safeParse(event); if (!parsed.success) return;
      const ids = new Set(parsed.data.leftPresences.map(peer => peer.userId));
      ids.forEach(id => callbacks.current.onRemoteLeave(id));
      setPresenceUsers(previous => previous.filter(peer => !ids.has(peer.userId)));
    }).on('broadcast', { event: 'cursor_move' }, (event: unknown) => {
      if (!active() || !cursorBudget()) return;
      const parsed = cursorPayloadSchema.safeParse(payloadOf(event));
      if (parsed.success && parsed.data.userId !== userId) callbacks.current.onRemoteCursor(parsed.data);
    }).on('broadcast', { event: 'draw_start' }, (event: unknown) => {
      if (!active() || !boundaryBudget()) return;
      const parsed = drawPayloadSchemas.draw_start.safeParse(payloadOf(event));
      if (parsed.success && parsed.data.userId !== userId) callbacks.current.onDrawEvent({ type: 'draw_start', ...parsed.data });
    }).on('broadcast', { event: 'draw_point' }, (event: unknown) => {
      if (!active() || !drawBudget()) return;
      const parsed = drawPayloadSchemas.draw_point.safeParse(payloadOf(event));
      if (parsed.success && parsed.data.userId !== userId) callbacks.current.onDrawEvent({ type: 'draw_point', ...parsed.data });
    }).on('broadcast', { event: 'draw_end' }, (event: unknown) => {
      if (!active() || !boundaryBudget()) return;
      const parsed = drawPayloadSchemas.draw_end.safeParse(payloadOf(event));
      if (parsed.success && parsed.data.userId !== userId) callbacks.current.onDrawEvent({ type: 'draw_end', ...parsed.data, path: parsed.data.path! });
    }).on('broadcast', { event: 'annotation_add' }, async (event: unknown) => {
      if (!active() || !annotationBudget() || pendingRefreshes >= 2) return;
      const parsed = annotationAddPayloadSchema.safeParse(payloadOf(event)); if (!parsed.success) return;
      pendingRefreshes++;
      try {
        const { data, error } = await supabase.from('annotations').select('*').eq('workspace_id', analysisId).eq('id', parsed.data.annotation.id).maybeSingle();
        const annotation = !error ? parseAnnotationRow(data, analysisId) : null;
        if (active() && annotation) callbacks.current.onAnnotation({ type: 'annotation_add', annotation });
      } catch { /* A broadcast is only a refresh hint; authorization remains in the database. */ }
      finally { pendingRefreshes--; }
    }).on('broadcast', { event: 'annotation_delete' }, async (event: unknown) => {
      if (!active() || !annotationBudget() || pendingRefreshes >= 2) return;
      const parsed = annotationIdPayloadSchema.safeParse(payloadOf(event)); if (!parsed.success) return;
      pendingRefreshes++;
      try {
        const { data, error } = await supabase.from('annotations').select('id').eq('workspace_id', analysisId).eq('id', parsed.data.id).maybeSingle();
        if (active() && !error && !data) callbacks.current.onAnnotation({ type: 'annotation_delete', id: parsed.data.id });
      } catch { /* Ignore an unverified deletion hint. */ }
      finally { pendingRefreshes--; }
    }).subscribe(async status => {
      if (!active()) return;
      if (status === 'SUBSCRIBED') {
        setConnected(true); reconnectDelay.current = 1000;
        try { await channel.track({ userId, name, color, cursorX: 0, cursorY: 0 }); }
        catch { if (active()) setConnected(false); }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(() => { reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000); connect(); }, reconnectDelay.current);
      }
    });
    channelRef.current = channel;
  }, [analysisId, userId, name, color, usable]);
  useEffect(() => {
    connect();
    return () => {
      generation.current++;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      const channel = channelRef.current; channelRef.current = null;
      if (channel) void Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
    };
  }, [connect]);
  const send = useCallback((event: string, payload: unknown) => {
    if (channelRef.current) void Promise.resolve(channelRef.current.send({ type: 'broadcast', event, payload })).catch(() => {});
  }, []);
  const broadcastCursor = useCallback((x: number, y: number) => {
    const payload = cursorPayloadSchema.safeParse({ userId, name, color, cursorX: x, cursorY: y });
    if (!payload.success || Date.now() - lastCursor.current < 50) return;
    lastCursor.current = Date.now(); send('cursor_move', payload.data);
  }, [userId, name, color, send]);
  const broadcastDrawStart = useCallback((strokeColor: string, width: number, point: DrawPoint) => {
    const parsed = drawPayloadSchemas.draw_start.safeParse({ userId, color: strokeColor, width, point });
    if (parsed.success) send('draw_start', parsed.data);
  }, [userId, send]);
  const broadcastDrawPoint = useCallback((point: DrawPoint) => {
    const parsed = drawPayloadSchemas.draw_point.safeParse({ userId, point });
    if (!parsed.success || Date.now() - lastPoint.current < 16) return;
    lastPoint.current = Date.now(); send('draw_point', parsed.data);
  }, [userId, send]);
  const broadcastDrawEnd = useCallback((path: DrawPoint[], strokeColor: string, width: number) => {
    const parsed = drawPayloadSchemas.draw_end.safeParse({ userId, path, color: strokeColor, width });
    if (parsed.success) send('draw_end', parsed.data);
  }, [userId, send]);
  const saveAnnotation = useCallback(async (annotation: Omit<StoredAnnotation, 'id'|'createdAt'>): Promise<StoredAnnotation | null> => {
    if (!usable || annotation.userId !== userId) return null;
    const current = generation.current;
    const input = annotationInputSchema.safeParse(annotation); if (!input.success) return null;
    try {
      const { data, error } = await supabase.from('annotations').insert({ workspace_id: analysisId, user_id: userId, user_name: name, user_color: color, type: input.data.type, data: input.data.data }).select().single();
      const saved = !error ? parseAnnotationRow(data, analysisId) : null;
      if (generation.current !== current) return null;
      if (saved) send('annotation_add', { annotation: { id: saved.id } });
      return saved;
    } catch { return null; }
  }, [analysisId, userId, name, color, usable, send]);
  const deleteAnnotation = useCallback(async (id: string) => {
    if (!usable || !uuidSchema.safeParse(id).success) return;
    const current = generation.current;
    const { data, error } = await supabase.from('annotations').delete().eq('workspace_id', analysisId).eq('user_id', userId).eq('id', id).select('id');
    if (error) throw new Error('The annotation could not be deleted.');
    if (generation.current === current && Array.isArray(data) && data.some(row => row.id === id)) send('annotation_delete', { id });
  }, [analysisId, userId, usable, send]);
  const loadAnnotations = useCallback(async (): Promise<StoredAnnotation[]> => {
    if (!usable) return [];
    const current = generation.current;
    try {
      const { data, error } = await supabase.from('annotations').select('*').eq('workspace_id', analysisId).order('created_at', { ascending: false }).limit(MAX_ANNOTATIONS);
      if (generation.current !== current || error || !Array.isArray(data)) return [];
      return data.slice(0, MAX_ANNOTATIONS).map(row => parseAnnotationRow(row, analysisId)).filter((row): row is StoredAnnotation => row !== null).reverse();
    } catch { return []; }
  }, [analysisId, usable]);
  return { connected, presenceUsers, broadcastCursor, broadcastDrawStart, broadcastDrawPoint, broadcastDrawEnd, saveAnnotation, deleteAnnotation, loadAnnotations };
}
