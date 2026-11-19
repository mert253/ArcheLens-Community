import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye, Globe, GlobeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useMuseum } from '../../hooks/useMuseum';
import { useHistory } from '../../hooks/useHistory';
import { normalizeStoredMuseumImage } from '../../lib/museumImage';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import type { Museum, MuseumRoom, MuseumArtifactPlacement, RoomLayout } from '../../types';

const LAYOUTS: { key: RoomLayout; label_tr: string; label_en: string; grid: { col: number; row: number }[] }[] = [
  {
    key: 'square',
    label_tr: 'Kare Oda', label_en: 'Square Room',
    grid: Array.from({ length: 25 }, (_, i) => ({ col: i % 5, row: Math.floor(i / 5) })),
  },
  {
    key: 'gallery',
    label_tr: 'Galeri Koridoru', label_en: 'Gallery Hall',
    // 8 positions along each side wall
    grid: [
      ...Array.from({ length: 8 }, (_, i) => ({ col: i, row: 0 })), // top wall
      ...Array.from({ length: 8 }, (_, i) => ({ col: i, row: 2 })), // bottom wall
    ],
  },
  {
    key: 'circular',
    label_tr: 'Yuvarlak Salon', label_en: 'Circular Hall',
    grid: Array.from({ length: 8 }, (_, i) => ({ col: i, row: 0 })),
  },
];

function gridToWorld(layout: RoomLayout, col: number, row: number): { x: number; y: number; z: number } {
  if (layout === 'square') {
    return { x: (col - 2) * 4, y: 0, z: (row - 2) * 4 };
  }
  if (layout === 'gallery') {
    return { x: row === 0 ? -4 : 4, y: 0, z: (col - 3.5) * 3.5 };
  }
  // circular
  const angle = (col / 8) * Math.PI * 2;
  return { x: Math.sin(angle) * 7, y: 0, z: Math.cos(angle) * 7 };
}

interface EditorProps {
  roomId: string;
  museumIsPublic: boolean;
  onBack: () => void;
  onView: (roomId: string) => void;
  lang: 'tr' | 'en';
}

const RoomEditor: React.FC<EditorProps> = ({ roomId, museumIsPublic, onBack, onView, lang }) => {
  const tr = lang === 'tr';
  const museum = useMuseum();
  const { entries } = useHistory();
  const [room, setRoom]         = useState<MuseumRoom | null>(null);
  const [placements, setPlacements] = useState<MuseumArtifactPlacement[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // history entry id to place
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    museum.getRoom(roomId).then(r => r && setRoom(r));
    museum.getRoomArtifacts(roomId).then(setPlacements);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleCellClick = useCallback(async (col: number, row: number) => {
    const layout = room?.layout;
    if (!layout || !selected) return;

    const pos = gridToWorld(layout, col, row);
    const already = placements.find(p => Math.abs(p.position.x - pos.x) < 0.5 && Math.abs(p.position.z - pos.z) < 0.5);
    if (already) {
      if (await museum.removeArtifact(already.id)) {
        setPlacements(prev => prev.filter(p => p.id !== already.id));
      }
      return;
    }

    const entry = entries.find(e => e.id === selected);
    if (!entry) return;

    const placed = await museum.addArtifact(roomId, entry.id, entry.result, normalizeStoredMuseumImage(entry.imageDataUrl) || undefined, pos);
    if (placed) {
      setPlacements(prev => [...prev, placed]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [room, selected, placements, entries, museum, roomId]);

  const handleRemovePlacement = async (id: string) => {
    if (await museum.removeArtifact(id)) {
      setPlacements(prev => prev.filter(p => p.id !== id));
    }
  };

  const togglePublic = async () => {
    if (!room) return;
    const updated = await museum.updateRoom(room.id, { isPublic: !room.isPublic });
    if (updated) setRoom(updated);
  };

  const layoutDef = LAYOUTS.find(l => l.key === room?.layout);

  const placementMap = React.useMemo(() => {
    const map = new Map<string, MuseumArtifactPlacement>();
    if (!room || !layoutDef) return map;
    for (const p of placements) {
      for (const { col, row } of layoutDef.grid) {
        const pos = gridToWorld(room.layout, col, row);
        if (Math.abs(p.position.x - pos.x) < 0.5 && Math.abs(p.position.z - pos.z) < 0.5) {
          map.set(`${col},${row}`, p);
          break;
        }
      }
    }
    return map;
  }, [placements, room?.layout, layoutDef]);

  if (!room || !layoutDef) return (
    <div className="flex items-center justify-center h-64">
      {museum.error ? <p role="alert" className="text-sm text-red-400">{museum.error}</p> : <Loader2 className="w-6 h-6 animate-spin text-amber-500" />}
    </div>
  );

  const isOccupied = (col: number, row: number) => placementMap.has(`${col},${row}`);

  const getArtifactAt = (col: number, row: number) => placementMap.get(`${col},${row}`);

  return (
    <div className="flex gap-8">
      {/* Left: artifact picker */}
      <div className="w-64 shrink-0">
        <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">
          {tr ? 'Analiz Geçmişi' : 'Analysis History'}
        </h3>
        <p className="text-[10px] text-stone-500 mb-4">
          {tr ? 'Bir eser seç → odadaki hücreye tıkla' : 'Select artifact → click a room cell'}
        </p>
        {entries.length === 0 ? (
          <p className="text-xs text-stone-500 italic">{tr ? 'Geçmiş boş' : 'No history'}</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {entries.map(e => (
              <div
                key={e.id}
                onClick={() => setSelected(selected === e.id ? null : e.id)}
                className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${selected === e.id ? 'border-amber-500 bg-amber-500/10' : 'border-stone-700 hover:border-stone-500'}`}
              >
                <img src={e.imageDataUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                <span className="text-xs font-medium text-stone-300 line-clamp-2">{e.result.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center: room grid */}
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-stone-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-lg font-serif text-stone-200">{room.name}</h2>
          <span className="text-[10px] bg-stone-800 border border-stone-700 text-stone-400 px-2 py-0.5 rounded-full uppercase tracking-widest">
            {tr ? layoutDef.label_tr : layoutDef.label_en}
          </span>
          <button onClick={togglePublic} disabled={museum.loading} aria-label={room.isPublic ? 'Make room private' : 'Mark room public'} className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border transition-colors ${room.isPublic ? 'border-green-500 text-green-400 hover:bg-green-500/10' : 'border-stone-600 text-stone-400 hover:border-stone-400'}`}>
            {room.isPublic ? <Globe size={12} /> : <GlobeOff size={12} />}
            {room.isPublic ? (tr ? 'Herkese Açık' : 'Public') : (tr ? 'Özel' : 'Private')}
          </button>
          <button onClick={() => onView(roomId)} className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-500 text-amber-400 hover:bg-amber-500/10 transition-colors">
            <Eye size={12} /> {tr ? '3D Gezinti' : '3D View'}
          </button>
          {saved && <CheckCircle2 size={16} className="text-green-400" />}
        </div>

        {museum.error && <p role="alert" className="text-sm text-red-400 mb-3">{museum.error}</p>}
        <p className="text-xs text-stone-400 mb-4">
          {room.isPublic && museumIsPublic
            ? (tr ? 'Bu oda ve yerleştirilmiş eserler ziyaretçilere açıktır.' : 'Visitors can see this room and its placed images and analyses.')
            : room.isPublic
              ? (tr ? 'Müze yayımlanana kadar bu oda ziyaretçilere kapalıdır. Müze listesine dönerek yayımlayabilirsin.' : 'This room remains private to visitors until its museum is published. Return to the museum list to publish it.')
              : (tr ? 'Bu oda özeldir. Ziyaretçiler için hem müze yayımlanmalı hem oda herkese açık olarak işaretlenmelidir.' : 'This room is private. Visitors need both a published museum and a room marked public.')}
        </p>

        {/* Grid preview */}
        <div
          className="bg-stone-900/60 border border-stone-700 rounded-2xl p-6"
          style={{
            display: 'grid',
            gridTemplateColumns: room.layout === 'gallery' ? 'repeat(8, 1fr)' : room.layout === 'circular' ? 'repeat(8, 1fr)' : 'repeat(5, 1fr)',
            gridTemplateRows: room.layout === 'gallery' ? 'repeat(3, 1fr)' : room.layout === 'circular' ? '1fr' : 'repeat(5, 1fr)',
            gap: '8px',
          }}
        >
          {layoutDef.grid.map(({ col, row }, i) => {
            const occupied = isOccupied(col, row);
            const artifact = getArtifactAt(col, row);
            return (
              <div
                key={i}
                onClick={() => handleCellClick(col, row)}
                className={`aspect-square rounded-lg border cursor-pointer flex items-center justify-center transition-all relative overflow-hidden
                  ${occupied ? 'border-amber-500 bg-amber-500/10' : selected ? 'border-stone-600 hover:border-amber-400 hover:bg-amber-500/5' : 'border-stone-700 cursor-default'}
                `}
                style={{ gridColumn: col + 1, gridRow: row + 1 }}
                title={artifact?.artifactData?.title}
              >
                {artifact && (
                  <>
                    <img src={artifact.artifactImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                    <button
                      onClick={e => { e.stopPropagation(); handleRemovePlacement(artifact.id); }}
                      className="absolute top-1 right-1 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center text-white hover:bg-red-400 transition-colors"
                    >
                      <Trash2 size={8} />
                    </button>
                  </>
                )}
                {!occupied && selected && (
                  <span className="text-stone-600 text-lg">+</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-stone-500 mt-3">
          {tr ? `${placements.length} eser yerleştirildi` : `${placements.length} artifact(s) placed`}
        </p>
      </div>
    </div>
  );
};

// ─── Main MuseumEditor ─────────────────────────────────────────────────────────
export const MuseumEditor: React.FC = () => {
  const { user } = useAppStore();
  const { lang, setAppMode, updateUI } = useUIStore();
  const tr = lang === 'tr';
  const museum = useMuseum();

  const [museums, setMuseums]   = useState<Museum[]>([]);
  const [view, setView]         = useState<'list' | 'rooms' | 'edit'>('list');
  const [selectedMuseum, setSelectedMuseum] = useState<Museum | null>(null);
  const [rooms, setRooms]       = useState<MuseumRoom[]>([]);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);

  // Create forms
  const [newMuseumName, setNewMuseumName] = useState('');
  const [newRoomName, setNewRoomName]     = useState('');
  const [newRoomLayout, setNewRoomLayout] = useState<RoomLayout>('square');

  const userId = user?.id || '';

  useEffect(() => {
    if (userId) museum.getMyMuseums(userId).then(setMuseums);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleCreateMuseum = async () => {
    if (!newMuseumName.trim()) return;
    const m = await museum.createMuseum(userId, newMuseumName.trim());
    if (m) { setMuseums(prev => [m, ...prev]); setNewMuseumName(''); }
  };

  const handleOpenMuseum = async (m: Museum) => {
    setSelectedMuseum(m);
    const r = await museum.getRooms(m.id);
    setRooms(r);
    setView('rooms');
  };

  const handleDeleteMuseum = async (id: string) => {
    if (await museum.deleteMuseum(id)) setMuseums(prev => prev.filter(m => m.id !== id));
  };

  const toggleMuseumPublic = async (item: Museum) => {
    const updated = await museum.updateMuseum(item.id, { isPublic: !item.isPublic });
    if (!updated) return;
    setMuseums(prev => prev.map(m => m.id === updated.id ? updated : m));
    setSelectedMuseum(prev => prev?.id === updated.id ? updated : prev);
  };

  const handleCreateRoom = async () => {
    if (!selectedMuseum || !newRoomName.trim()) return;
    const r = await museum.createRoom(selectedMuseum.id, newRoomName.trim(), newRoomLayout);
    if (r) { setRooms(prev => [...prev, r]); setNewRoomName(''); }
  };

  const handleDeleteRoom = async (id: string) => {
    if (await museum.deleteRoom(id)) setRooms(prev => prev.filter(r => r.id !== id));
  };

  if (view === 'edit' && editingRoom) {
    return (
      <div className="animate-fade-in">
        <RoomEditor
          roomId={editingRoom}
          museumIsPublic={selectedMuseum?.isPublic ?? false}
          lang={lang}
          onBack={() => setView('rooms')}
          onView={(rid) => {
            updateUI({ museumRoomId: rid });
            setAppMode('museum');
          }}
        />
      </div>
    );
  }

  if (view === 'rooms' && selectedMuseum) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-stone-400 hover:text-white transition-colors"><ArrowLeft size={16} /></button>
          <h2 className="text-xl font-serif text-stone-200">{selectedMuseum.name}</h2>
          <button onClick={() => toggleMuseumPublic(selectedMuseum)} disabled={museum.loading} className="text-xs border border-amber-500/50 rounded-full px-3 py-1 text-amber-400">
            {selectedMuseum.isPublic ? (tr ? 'Müzeyi Gizle' : 'Unpublish museum') : (tr ? 'Müzeyi Yayımla' : 'Publish museum')}
          </button>
        </div>
        <p className="text-xs text-stone-400">{tr ? 'Yayımlama yalnızca herkese açık işaretli odaları ve eserlerini ziyaretçilere açar. Özel odalar gizli kalır.' : 'Publishing exposes only rooms also marked public, including their placed images and analyses. Private rooms remain hidden.'}</p>
        {museum.error && <p role="alert" className="text-sm text-red-400">{museum.error}</p>}

        {/* Create room */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-1">{tr ? 'Oda Adı' : 'Room Name'}</label>
            <input
              value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
              placeholder={tr ? 'örn. Antik Mısır Salonu' : 'e.g. Ancient Egypt Hall'}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-1">{tr ? 'Şablon' : 'Layout'}</label>
            <select
              value={newRoomLayout} onChange={e => setNewRoomLayout(e.target.value as RoomLayout)}
              className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-200 focus:border-amber-500 focus:outline-none"
            >
              {LAYOUTS.map(l => <option key={l.key} value={l.key}>{tr ? l.label_tr : l.label_en}</option>)}
            </select>
          </div>
          <button onClick={handleCreateRoom} disabled={museum.loading} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-colors">
            <Plus size={14} /> {tr ? 'Oda Ekle' : 'Add Room'}
          </button>
        </div>

        {/* Room list */}
        {rooms.length === 0 ? (
          <p className="text-stone-500 text-sm italic">{tr ? 'Henüz oda yok.' : 'No rooms yet.'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(r => (
              <div key={r.id} className="glass-panel border border-stone-700 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-stone-200 text-sm">{r.name}</h4>
                    <span className="text-[10px] text-stone-500 uppercase tracking-widest">
                      {tr ? LAYOUTS.find(l => l.key === r.layout)?.label_tr : LAYOUTS.find(l => l.key === r.layout)?.label_en}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteRoom(r.id)} className="text-stone-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingRoom(r.id); setView('edit'); }} className="flex-1 text-[10px] font-bold py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors uppercase tracking-widest">
                    {tr ? 'Düzenle' : 'Edit'}
                  </button>
                  <button
                    onClick={() => {
                      updateUI({ museumRoomId: r.id } as any);
                      setAppMode('museum');
                    }}
                    className="flex-1 text-[10px] font-bold py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors uppercase tracking-widest flex items-center justify-center gap-1"
                  >
                    <Eye size={12} /> {tr ? 'Gez' : 'View'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Museum list view
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h2 className="text-2xl font-serif text-stone-200 mb-1">{tr ? 'Sanal Müzelerim' : 'My Virtual Museums'}</h2>
        <p className="text-sm text-stone-500">{tr ? 'Analizlerinden oluşan 3D müzeler oluştur ve paylaş.' : 'Create and share 3D museums from your analyses.'}</p>
        <p className="text-xs text-stone-400 mt-2">{tr ? 'Yeni müzeler ve odalar özeldir. Ziyaretçiler yalnızca yayımlanmış bir müzenin herkese açık odalarını görebilir.' : 'New museums and rooms are private. Visitors can only see public rooms inside a published museum.'}</p>
      </div>

      {museum.error && <p role="alert" className="text-sm text-red-400">{museum.error}</p>}

      {/* Create museum */}
      <div className="flex gap-3">
        <input
          value={newMuseumName} onChange={e => setNewMuseumName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateMuseum()}
          placeholder={tr ? 'Yeni müze adı...' : 'New museum name...'}
          className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-200 focus:border-amber-500 focus:outline-none"
        />
        <button onClick={handleCreateMuseum} disabled={museum.loading || !newMuseumName.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-colors">
          {museum.loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {tr ? 'Müze Oluştur' : 'Create Museum'}
        </button>
      </div>

      {museums.length === 0 ? (
        <p className="text-stone-500 text-sm italic">{tr ? 'Henüz müze yok.' : 'No museums yet.'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {museums.map(m => (
            <div key={m.id} className="glass-panel border border-stone-700 hover:border-stone-500 rounded-2xl p-5 cursor-pointer transition-all group" onClick={() => handleOpenMuseum(m)}>
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-serif text-stone-200 text-base group-hover:text-amber-400 transition-colors">{m.name}</h4>
                <button onClick={e => { e.stopPropagation(); handleDeleteMuseum(m.id); }} className="text-stone-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
              {m.description && <p className="text-xs text-stone-500 mb-3">{m.description}</p>}
              <button
                onClick={e => { e.stopPropagation(); toggleMuseumPublic(m); }}
                disabled={museum.loading}
                className="flex items-center gap-1.5 text-xs border border-amber-500/50 rounded-full px-3 py-1 text-amber-400 mb-3"
              >
                {m.isPublic ? <Globe size={12} /> : <GlobeOff size={12} />}
                {m.isPublic ? (tr ? 'Müzeyi Gizle' : 'Unpublish museum') : (tr ? 'Müzeyi Yayımla' : 'Publish museum')}
              </button>
              <span className="text-[9px] text-stone-500 uppercase tracking-widest">{new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
