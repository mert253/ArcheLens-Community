/**
 * Digital Jigsaw — Potsherd Matching Engine
 * Drag & drop up to 500 images → OpenCV.js shape+texture matching in a Web Worker
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Upload, Play, Square, FileText, CheckCircle2,
  XCircle, Puzzle, AlertTriangle, Download,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { PotsherdFile, PotsherdMatch } from '../../types';
import { csvTextCell } from '../../lib/csv';

// ─── Dexie for match persistence ───────────────────────────────────────────────
import Dexie, { type EntityTable } from 'dexie';

interface MatchRecord {
  id: string; pieceA: string; pieceB: string;
  score: number; edgeSim: number; textureSim: number;
  marked: number; createdAt: number;
}

const matchDb = new Dexie('ArcheLensOpenSourceMatches') as Dexie & {
  matches: EntityTable<MatchRecord, 'id'>;
};
matchDb.version(1).stores({ matches: 'id, createdAt' });

async function saveMatch(m: PotsherdMatch) {
  const rec: MatchRecord = {
    id: m.id, pieceA: m.a, pieceB: m.b,
    score: m.score, edgeSim: m.edgeSim, textureSim: m.textureSim,
    marked: m.marked ? 1 : 0, createdAt: Date.now(),
  };
  await matchDb.matches.put(rec);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function scoreLabel(score: number, tr: boolean): { text: string; color: string } {
  if (score >= 0.75) return { text: tr ? 'Yüksek olasılık' : 'High probability', color: '#22c55e' };
  if (score >= 0.5)  return { text: tr ? 'Olası'          : 'Possible',          color: '#f59e0b' };
  return                     { text: tr ? 'Zayıf'         : 'Weak',              color: '#ef4444' };
}

function exportCSV(files: PotsherdFile[], matches: PotsherdMatch[], tr: boolean) {
  const header = tr
    ? ['parça_A', 'parça_B', 'skor', 'kenar_benzerliği', 'doku_benzerliği', 'işaretlendi_mi']
    : ['piece_A', 'piece_B', 'score', 'edge_sim', 'texture_sim', 'marked'];

  const rows = matches.map(m => [
    m.nameA, m.nameB,
    m.score.toFixed(3),
    m.edgeSim.toFixed(3),
    m.textureSim.toFixed(3),
    m.marked ? '1' : '0',
  ].map(csvTextCell).join(','));

  const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'potsherd_matches.csv'; link.click();
  URL.revokeObjectURL(url);
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MatchApp() {
  const { lang, setAppMode } = useUIStore();
  const tr = lang === 'tr';

  const [files, setFiles]     = useState<PotsherdFile[]>([]);
  const [status, setStatus]   = useState<'idle' | 'processing' | 'done'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [matches, setMatches] = useState<PotsherdMatch[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const dropRef   = useRef<HTMLDivElement>(null);

  // Cleanup worker on unmount
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  // ── File handling ──
  const addFiles = useCallback((newFiles: File[]) => {
    const accepted = newFiles
      .filter(f => f.type === 'image/jpeg' || f.type === 'image/png')
      .slice(0, 500 - files.length);

    const potsherd: PotsherdFile[] = accepted.map(f => ({
      id:   crypto.randomUUID(),
      name: f.name,
      url:  URL.createObjectURL(f),
    }));

    setFiles(prev => [...prev, ...potsherd]);

    // Store file data for worker (kept in a parallel Map keyed by id)
    accepted.forEach((f, i) => {
      fileBuffers.current.set(potsherd[i].id, f);
    });
  }, [files.length]);

  const fileBuffers = useRef<Map<string, File>>(new Map());

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter(x => x.id !== id);
    });
    fileBuffers.current.delete(id);
  };

  const clearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.url));
    setFiles([]); fileBuffers.current.clear();
    setMatches([]); setStatus('idle'); setError(null);
  };

  // ── Processing ──
  const startProcessing = async () => {
    if (files.length < 2) return;
    setStatus('processing'); setError(null); setMatches([]);
    setProgress({ done: 0, total: (files.length * (files.length - 1)) / 2 });

    // Read all files as ArrayBuffers (transferable)
    const fileInputs: { id: string; name: string; buffer: ArrayBuffer }[] = [];
    for (const pf of files) {
      const file = fileBuffers.current.get(pf.id);
      if (file) fileInputs.push({ id: pf.id, name: pf.name, buffer: await file.arrayBuffer() });
    }

    const transferable = fileInputs.map(f => f.buffer);

    const worker = new Worker(
      new URL('../../workers/potsherWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data;
      if (type === 'PROGRESS') {
        setProgress({ done: e.data.done, total: e.data.total });
      } else if (type === 'DONE') {
        setMatches(e.data.matches);
        setStatus('done');
        worker.terminate();
      } else if (type === 'ERROR') {
        setError(e.data.message);
        setStatus('idle');
        worker.terminate();
      } else if (type === 'LOG') {
        useAppStore.getState().addLog(e.data.severity, e.data.msg, e.data.meta);
      }
    };

    worker.onerror = (err) => {
      setError(err.message);
      setStatus('idle');
      worker.terminate();
    };

    worker.postMessage({ type: 'PROCESS', files: fileInputs }, transferable);
  };

  const stopProcessing = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus('idle');
  };

  // ── Toggle mark ──
  const toggleMark = async (id: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, marked: !m.marked };
      saveMatch(updated).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        useAppStore.getState().addLog('warn', 'Match save failed', { error: message });
        setError(message);
      });
      return updated;
    }));
  };

  const markedMatches  = matches.filter(m => m.marked);
  const highMatches    = matches.filter(m => m.score >= 0.75);
  const possibleMatches = matches.filter(m => m.score >= 0.5 && m.score < 0.75);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setAppMode('main')}
          className="w-10 h-10 glass-panel border border-[var(--border-primary)] rounded-full flex items-center justify-center
            text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-4xl font-serif text-[var(--text-primary)]">
            {tr ? 'Dijital Jigsaw' : 'Digital Jigsaw'}
          </h1>
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-widest mt-1">
            {tr ? 'Potsherd Eşleştirme Motoru' : 'Potsherd Matching Engine'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {matches.length > 0 && (
            <button
              onClick={() => exportCSV(files, matches, tr)}
              className="flex items-center gap-2 px-4 py-2 glass-panel border border-[var(--border-primary)] rounded-full text-[10px]
                font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--accent)]
                hover:border-[var(--accent)] transition-all"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
          {files.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 glass-panel border border-[var(--border-primary)] rounded-full text-[10px]
                font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-red-400
                hover:border-red-400 transition-all"
            >
              <XCircle className="w-3.5 h-3.5" /> {tr ? 'Temizle' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {/* Stats bar (after done) */}
      {status === 'done' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: tr ? 'Toplam eşleşme' : 'Total matches', val: matches.length, color: 'text-[var(--accent)]' },
            { label: tr ? 'Yüksek olasılık' : 'High probability', val: highMatches.length, color: 'text-green-400' },
            { label: tr ? 'İşaretlendi' : 'Marked', val: markedMatches.length, color: 'text-blue-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="glass-panel border border-[var(--border-primary)] rounded-2xl px-5 py-4 text-center">
              <p className={`text-3xl font-serif font-bold ${color}`}>{val}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
        {/* ── LEFT: Upload ── */}
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-[2rem] p-8 text-center transition-all duration-300 cursor-pointer
              ${dragging
                ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-[var(--border-primary)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-secondary)]'}`}
            onClick={() => document.getElementById('potsherd-file-input')?.click()}
          >
            <input
              id="potsherd-file-input"
              type="file"
              multiple
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={onInputChange}
            />
            <Puzzle className="w-10 h-10 mx-auto mb-4 text-[var(--accent)] opacity-70" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              {tr ? 'Parçaları Sürükle & Bırak' : 'Drag & Drop Sherds'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              JPEG / PNG · {tr ? 'Maks. 500 görsel' : 'Max 500 images'}
            </p>
            {files.length > 0 && (
              <p className="mt-3 text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">
                {files.length} {tr ? 'dosya yüklendi' : 'files loaded'}
              </p>
            )}
          </div>

          {/* Action button */}
          {status === 'idle' && files.length >= 2 && (
            <button
              onClick={startProcessing}
              className="w-full h-14 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-[2rem] text-xs font-bold
                uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[var(--accent)]
                hover:text-white transition-all shadow-xl"
            >
              <Play className="w-4 h-4" />
              {tr ? 'Eşleştirmeyi Başlat' : 'Start Matching'}
            </button>
          )}

          {status === 'processing' && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] font-mono">
                <span>{progress.done} / {progress.total} {tr ? 'çift' : 'pairs'}</span>
                <span>{pct}%</span>
              </div>
              <button
                onClick={stopProcessing}
                className="w-full h-12 glass-panel border border-red-500/30 rounded-[2rem] text-xs font-bold
                  uppercase tracking-widest text-red-400 flex items-center justify-center gap-2 hover:border-red-400 transition-all"
              >
                <Square className="w-3.5 h-3.5" /> {tr ? 'Durdur' : 'Stop'}
              </button>
            </div>
          )}

          {files.length < 2 && files.length > 0 && (
            <p className="text-xs text-amber-400 text-center">
              {tr ? 'En az 2 görsel gerekli' : 'At least 2 images required'}
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Thumbnail grid */}
          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
              {files.map(f => (
                <div key={f.id} className="relative group aspect-square rounded-xl overflow-hidden bg-stone-900">
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center
                      transition-opacity text-white text-xs"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="space-y-4">
          {status === 'idle' && matches.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--text-tertiary)]">
              <Puzzle className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-semibold">{tr ? 'Eşleşme sonuçları burada görünecek' : 'Match results will appear here'}</p>
              <p className="text-xs mt-1 opacity-70">{tr ? 'Görsel yükle ve işlemi başlat' : 'Upload images and start processing'}</p>
            </div>
          )}

          {matches.length > 0 && (
            <>
              {/* High probability section */}
              {highMatches.length > 0 && (
                <Section title={tr ? 'Yüksek Olasılık' : 'High Probability'} color="text-green-400" count={highMatches.length}>
                  {highMatches.map(m => (
                    <MatchCard key={m.id} match={m} files={files} lang={lang} onToggleMark={toggleMark} />
                  ))}
                </Section>
              )}

              {/* Possible section */}
              {possibleMatches.length > 0 && (
                <Section title={tr ? 'Olası Eşleşmeler' : 'Possible Matches'} color="text-amber-400" count={possibleMatches.length}>
                  {possibleMatches.map(m => (
                    <MatchCard key={m.id} match={m} files={files} lang={lang} onToggleMark={toggleMark} />
                  ))}
                </Section>
              )}

              {matches.length === 0 && status === 'done' && (
                <div className="text-center py-8 text-[var(--text-tertiary)] text-xs">
                  {tr ? 'Eşik üzerinde eşleşme bulunamadı.' : 'No matches above threshold found.'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, color, count, children }: {
  title: string; color: string; count: number; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className={`w-4 h-4 ${color}`} />
        <h3 className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{title}</h3>
        <span className="text-[10px] text-[var(--text-tertiary)]">({count})</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function MatchCard({ match, files, lang, onToggleMark }: {
  match: PotsherdMatch;
  files: PotsherdFile[];
  lang: 'tr' | 'en';
  onToggleMark: (id: string) => void;
}) {
  const tr = lang === 'tr';
  const fileA = files.find(f => f.id === match.a);
  const fileB = files.find(f => f.id === match.b);
  const { text: labelText, color } = scoreLabel(match.score, tr);

  return (
    <div className={`glass-panel border rounded-2xl overflow-hidden transition-all duration-200
      ${match.marked
        ? 'border-blue-500/50 bg-blue-500/5'
        : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'}`}
    >
      <div className="flex gap-0">
        {/* Image A */}
        <div className="w-32 h-24 shrink-0 bg-stone-900 overflow-hidden">
          {fileA ? (
            <img src={fileA.url} alt={match.nameA} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[8px] text-stone-600">{match.nameA}</div>
          )}
        </div>

        {/* Score divider */}
        <div className="flex flex-col items-center justify-center px-3 gap-1 shrink-0 bg-[var(--bg-secondary)]">
          <div className="text-lg font-serif font-bold" style={{ color }}>
            {Math.round(match.score * 100)}%
          </div>
          <div className="text-[8px] uppercase tracking-widest font-bold" style={{ color }}>{labelText}</div>
        </div>

        {/* Image B */}
        <div className="w-32 h-24 shrink-0 bg-stone-900 overflow-hidden">
          {fileB ? (
            <img src={fileB.url} alt={match.nameB} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[8px] text-stone-600">{match.nameB}</div>
          )}
        </div>

        {/* Details + action */}
        <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate">{match.nameA}</p>
            <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate">{match.nameB}</p>
          </div>
          <div className="flex gap-3 text-[9px] text-[var(--text-tertiary)]">
            <span>{tr ? 'Kenar' : 'Edge'}: {Math.round(match.edgeSim * 100)}%</span>
            <span>{tr ? 'Doku' : 'Texture'}: {Math.round(match.textureSim * 100)}%</span>
          </div>
          <button
            onClick={() => onToggleMark(match.id)}
            className={`self-start text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-all
              ${match.marked
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-blue-400 hover:border-blue-400'}`}
          >
            {match.marked
              ? (tr ? 'İşaretlendi' : 'Marked')
              : (tr ? 'Aynı Kaba İşaretle' : 'Mark Same Vessel')}
          </button>
        </div>
      </div>
    </div>
  );
}
