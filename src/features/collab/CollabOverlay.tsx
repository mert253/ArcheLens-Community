import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pencil, Eraser, Trash2, Circle, Minus, Plus } from 'lucide-react';
import { useCollaboration, pickColor } from '../../hooks/useCollaboration';
import type { DrawBroadcast, AnnotationBroadcast } from '../../hooks/useCollaboration';
import type { CollabUser, DrawPoint, DrawStroke, StoredAnnotation } from '../../types';
import { cursorPayloadSchema, drawPayloadSchemas, MAX_ANNOTATIONS, MAX_BUFFERED_POINTS, MAX_PATH_POINTS, MAX_PEERS, MAX_STROKES, peerDisplayName } from './validation';

interface Props {
  analysisId: string;
  userId: string;
  userName: string;
  lang: 'tr' | 'en';
}

const PALETTE = ['#f59e0b','#ef4444','#10b981','#3b82f6','#8b5cf6','#ec4899','#ffffff','#1c1917'];
export function boundedStrokes(strokes: DrawStroke[]) {
  const result: DrawStroke[] = []; let points = 0;
  for (let i = strokes.length - 1; i >= 0 && result.length < MAX_STROKES; i--) {
    if (points + strokes[i].points.length > MAX_BUFFERED_POINTS) break;
    result.push(strokes[i]); points += strokes[i].points.length;
  }
  return result.reverse();
}
function appendPoint(points: DrawPoint[], point: DrawPoint) {
  const bounded = points.length >= MAX_PATH_POINTS ? points.filter((_point, index) => index % 2 === 0) : points;
  bounded.push(point); return bounded;
}

export const CollabOverlay: React.FC<Props> = ({ analysisId, userId, userName, lang }) => {
  const tr = lang === 'tr';
  const userColor = pickColor(userId);
  const displayName = peerDisplayName(userName);

  // Canvas refs
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const remoteRef    = useRef<HTMLCanvasElement>(null); // remote strokes (persisted)
  const containerRef = useRef<HTMLDivElement>(null);
  const drawFrame = useRef<number | null>(null);

  // Tool state
  const [drawMode, setDrawMode]     = useState(false);
  const [tool, setTool]             = useState<'pen' | 'eraser'>('pen');
  const [color, setColor]           = useState('#f59e0b');
  const [width, setWidth]           = useState(3);
  const [showPanel, setShowPanel]   = useState(true);

  // Remote cursors
  const [cursors, setCursors] = useState<Map<string, CollabUser>>(new Map());

  // Local drawing state
  const drawing      = useRef(false);
  const currentPath  = useRef<DrawPoint[]>([]);
  const remoteStrokes = useRef<DrawStroke[]>([]); // finished strokes from remote
  const inProgressStrokes = useRef<Map<string, { color: string; width: number; points: DrawPoint[] }>>(new Map());
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>([]);

  // Normalize coords to [0..1]
  const normalize = (e: MouseEvent | React.MouseEvent): DrawPoint => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))) };
  };

  const toCanvas = (pt: DrawPoint, canvas: HTMLCanvasElement): { x: number; y: number } => ({
    x: pt.x * canvas.width, y: pt.y * canvas.height,
  });

  // Draw all remote finished strokes onto remote canvas
  const redrawRemote = useCallback(() => {
    if (drawFrame.current !== null) return;
    drawFrame.current = requestAnimationFrame(() => {
    drawFrame.current = null;
    const canvas = remoteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    [...remoteStrokes.current, ...Array.from(inProgressStrokes.current.values()).map(s => ({ ...s, id: '', userId: '' }))].forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = (stroke as any).color;
      ctx.lineWidth   = (stroke as any).width;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      const [first, ...rest] = stroke.points;
      const fp = toCanvas(first, canvas);
      ctx.moveTo(fp.x, fp.y);
      rest.forEach(p => { const cp = toCanvas(p, canvas); ctx.lineTo(cp.x, cp.y); });
      ctx.stroke();
    });
    });
  }, []);

  // Resize canvases
  useEffect(() => {
    const resize = () => {
      [canvasRef.current, remoteRef.current].forEach(c => {
        if (!c) return;
        c.width = Math.max(1, Math.min(4096, window.innerWidth));
        c.height = Math.max(1, Math.min(4096, window.innerHeight));
      });
      redrawRemote();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (drawFrame.current !== null) cancelAnimationFrame(drawFrame.current); };
  }, [redrawRemote]);

  // Load persisted annotations on mount
  const { connected, presenceUsers, broadcastCursor, broadcastDrawStart, broadcastDrawPoint, broadcastDrawEnd, saveAnnotation, deleteAnnotation, loadAnnotations } = useCollaboration({
    analysisId, userId, userName: displayName, userColor,
    onRemoteCursor: (user) => {
      const parsed = cursorPayloadSchema.safeParse(user); if (!parsed.success) return;
      setCursors(previous => new Map([...previous, [parsed.data.userId, parsed.data] as const].slice(-MAX_PEERS)));
    },
    onRemoteLeave:  (uid)  => setCursors(prev => { const m = new Map(prev); m.delete(uid); return m; }),
    onDrawEvent: (ev: DrawBroadcast) => {
      const parsed = drawPayloadSchemas[ev.type]?.safeParse(ev);
      if (!parsed?.success) return;
      if (ev.type === 'draw_start') {
        if (!inProgressStrokes.current.has(ev.userId) && inProgressStrokes.current.size >= MAX_PEERS) inProgressStrokes.current.delete(inProgressStrokes.current.keys().next().value!);
        inProgressStrokes.current.set(ev.userId, { color: ev.color, width: ev.width, points: [ev.point] });
      } else if (ev.type === 'draw_point') {
        const s = inProgressStrokes.current.get(ev.userId);
        if (s) { s.points = appendPoint(s.points, ev.point); redrawRemote(); }
      } else if (ev.type === 'draw_end') {
        inProgressStrokes.current.delete(ev.userId);
        remoteStrokes.current = boundedStrokes([...remoteStrokes.current, { id: `live:${ev.userId}:${Date.now()}`, userId: ev.userId, color: ev.color, width: ev.width, points: ev.path }]);
        redrawRemote();
      }
    },
    onAnnotation: (ev: AnnotationBroadcast) => {
      if (ev.type === 'annotation_add') {
        setAnnotations(prev => [...prev.filter(annotation => annotation.id !== ev.annotation.id), ev.annotation].slice(-MAX_ANNOTATIONS));
        if (ev.annotation.type === 'draw') {
          const annotation = ev.annotation;
          const points = annotation.data.points as DrawPoint[];
          const strokeColor = annotation.data.color || annotation.userColor;
          remoteStrokes.current = boundedStrokes([...remoteStrokes.current.filter(stroke => stroke.id !== annotation.id && !(stroke.id.startsWith('live:') && stroke.userId === annotation.userId && stroke.color === strokeColor && stroke.width === annotation.data.width && stroke.points.length === points.length && stroke.points.every((point, index) => point.x === points[index].x && point.y === points[index].y))), { id: annotation.id, userId: annotation.userId, color: strokeColor, width: annotation.data.width, points }]);
        }
      } else {
        setAnnotations(prev => prev.filter(a => a.id !== ev.id));
        remoteStrokes.current = remoteStrokes.current.filter(stroke => stroke.id !== ev.id);
      }
      redrawRemote();
    },
  });

  useEffect(() => {
    let cancelled = false;
    setAnnotations([]); setCursors(new Map()); remoteStrokes.current = []; inProgressStrokes.current.clear(); currentPath.current = [];
    loadAnnotations().then(anns => {
      if (cancelled) return;
      setAnnotations(anns);
      // Replay draw annotations onto remote canvas
      anns.filter(a => a.type === 'draw').forEach(a => {
        remoteStrokes.current = boundedStrokes([...remoteStrokes.current, { id: a.id, userId: a.userId, color: a.data.color || a.userColor, width: a.data.width, points: a.data.points }]);
      });
      redrawRemote();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [analysisId, loadAnnotations, redrawRemote]);

  // Mouse events for drawing
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = normalize(e);
    broadcastCursor(pt.x, pt.y);

    if (!drawing.current) return;
    currentPath.current = appendPoint(currentPath.current, pt);
    broadcastDrawPoint(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pts = currentPath.current;
    if (pts.length < 2) return;
    const prev = toCanvas(pts[pts.length - 2], canvas);
    const curr = toCanvas(pts[pts.length - 1], canvas);
    ctx.beginPath();
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = width * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
    }
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, [broadcastCursor, broadcastDrawPoint, color, tool, width]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    drawing.current = true;
    const pt = normalize(e);
    currentPath.current = [pt];
    broadcastDrawStart(color, width, pt);
  }, [drawMode, color, width, broadcastDrawStart]);

  const onMouseUp = useCallback(async () => {
    if (!drawing.current) return;
    drawing.current = false;
    const path = [...currentPath.current];
    broadcastDrawEnd(path, color, width);
    if (path.length > 1) {
      const saved = await saveAnnotation({ userId, userName: displayName, userColor, type: 'draw', data: { points: path, color, width } });
      if (saved) setAnnotations(previous => [...previous.filter(annotation => annotation.id !== saved.id), saved].slice(-MAX_ANNOTATIONS));
    }
    currentPath.current = [];
  }, [broadcastDrawEnd, color, width, saveAnnotation, userId, displayName, userColor]);

  const clearMyStrokes = useCallback(async () => {
    const mine = annotations.filter(a => a.userId === userId && a.type === 'draw');
    try { await Promise.all(mine.map(a => deleteAnnotation(a.id))); } catch { return; }
    setAnnotations(prev => prev.filter(a => !(a.userId === userId && a.type === 'draw')));
    remoteStrokes.current = remoteStrokes.current.filter(s => s.userId !== userId);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    redrawRemote();
  }, [annotations, userId, deleteAnnotation, redrawRemote]);

  const inviteUrl = `${window.location.origin}/workspace/${analysisId}`;
  const copyInvite = () => { navigator.clipboard.writeText(inviteUrl); };

  const allUsers = [{ userId, name: displayName, color: userColor }, ...presenceUsers.filter(peer => cursorPayloadSchema.safeParse(peer).success && peer.userId !== userId).slice(0, MAX_PEERS)];

  return (
    <div ref={containerRef} className="fixed inset-0 z-[200] pointer-events-none">
      {/* Remote strokes canvas (always visible, pointer-events none) */}
      <canvas ref={remoteRef} className="absolute inset-0 w-full h-full opacity-70" style={{ pointerEvents: 'none' }} />

      {/* Local drawing canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: drawMode ? 'auto' : 'none', cursor: drawMode ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default', opacity: 0.85 }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />

      {/* Remote cursors */}
      {Array.from(cursors.values()).map(u => (
        <div
          key={u.userId}
          className="absolute pointer-events-none flex flex-col items-center gap-0.5 transition-all duration-75"
          style={{ left: `${u.cursorX * 100}%`, top: `${u.cursorY * 100}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div className="w-3 h-3 rounded-full border-2 border-white shadow-lg" style={{ background: u.color }} />
          <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shadow-md whitespace-nowrap" style={{ background: u.color }}>
            {u.name}
          </span>
        </div>
      ))}

      {/* Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 bg-stone-900/90 backdrop-blur-xl border border-stone-700 rounded-full px-4 py-2 shadow-2xl">
        {/* Toggle draw mode */}
        <button
          onClick={() => setDrawMode(d => !d)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${drawMode ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
        >
          <Pencil size={12} /> {tr ? 'Çiz' : 'Draw'}
        </button>

        {drawMode && (
          <>
            <div className="w-px h-6 bg-stone-700" />
            <button onClick={() => setTool('pen')} className={`p-1.5 rounded-full transition-colors ${tool === 'pen' ? 'bg-amber-500/30 text-amber-400' : 'text-stone-400 hover:text-stone-200'}`}><Pencil size={14} /></button>
            <button onClick={() => setTool('eraser')} className={`p-1.5 rounded-full transition-colors ${tool === 'eraser' ? 'bg-stone-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}><Eraser size={14} /></button>
            <div className="w-px h-6 bg-stone-700" />
            {PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'}`} style={{ background: c }} />
            ))}
            <div className="w-px h-6 bg-stone-700" />
            <button onClick={() => setWidth(w => Math.max(1, w - 1))} className="p-1 text-stone-400 hover:text-white transition-colors"><Minus size={12} /></button>
            <span className="text-[10px] text-stone-400 font-mono w-4 text-center">{width}</span>
            <button onClick={() => setWidth(w => Math.min(20, w + 1))} className="p-1 text-stone-400 hover:text-white transition-colors"><Plus size={12} /></button>
            <div className="w-px h-6 bg-stone-700" />
            <button onClick={clearMyStrokes} className="p-1.5 text-red-400 hover:text-red-300 transition-colors"><Trash2 size={14} /></button>
          </>
        )}
      </div>

      {/* User panel (right side) */}
      {showPanel && (
        <div className="absolute top-32 right-4 pointer-events-auto w-52 bg-stone-900/90 backdrop-blur-xl border border-stone-700 rounded-2xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
              <Circle size={8} className={connected ? 'text-green-400 fill-green-400' : 'text-red-400 fill-red-400'} />
              {tr ? 'Bu Oturumda' : 'In Session'}
            </span>
            <button aria-label={tr ? 'Kapat' : 'Close'} onClick={() => setShowPanel(false)} className="text-stone-500 hover:text-stone-300 text-xs">✕</button>
          </div>
          <div className="space-y-2">
            {allUsers.map(u => (
              <div key={u.userId} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white/20 shadow-sm flex-shrink-0" style={{ background: u.color }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-stone-300 truncate">
                  {u.name} {u.userId === userId ? <span className="text-[9px] text-stone-500">(siz)</span> : null}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={copyInvite}
            className="mt-4 w-full text-[10px] font-bold uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-stone-950 px-3 py-2 rounded-full transition-colors"
          >
            {tr ? 'Davet Et' : 'Invite'}
          </button>
        </div>
      )}

      {!showPanel && (
        <button
          onClick={() => setShowPanel(true)}
          className="absolute top-32 right-4 pointer-events-auto w-9 h-9 bg-stone-900/90 border border-stone-700 rounded-full flex items-center justify-center text-amber-400 hover:bg-stone-800 transition-colors shadow-lg"
        >
          <Circle size={14} className={connected ? 'fill-green-400 text-green-400' : 'fill-red-400 text-red-400'} />
        </button>
      )}
    </div>
  );
};
