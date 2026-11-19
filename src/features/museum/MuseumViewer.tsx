import React, { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { artifactImageState } from '../../lib/artifactImage';
import { normalizeStoredMuseumImage } from '../../lib/museumImage';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Environment, PerspectiveCamera, PointerLockControls } from '@react-three/drei';
import { createXRStore, XR, useXR, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import { X, Glasses, ArrowLeft, Eye, ExternalLink, Loader2 } from 'lucide-react';
import { useMuseum } from '../../hooks/useMuseum';
import { useUIStore } from '../../store/useUIStore';
import { useAppStore } from '../../store/useAppStore';
import type { MuseumRoom, MuseumArtifactPlacement } from '../../types';

const xrStore = createXRStore({ hand: true, controller: true });

// ─── Room geometry ─────────────────────────────────────────────────────────────
function RoomMesh({ layout }: { layout: MuseumRoom['layout'] }) {
  const W = layout === 'gallery' ? 30 : 22;
  const D = layout === 'gallery' ? 10 : 22;
  const H = 4;
  const wallMat = <meshStandardMaterial color="#e8e0d0" roughness={0.9} />;
  const floorMat = <meshStandardMaterial color="#c8b89a" roughness={0.8} />;
  const ceilMat  = <meshStandardMaterial color="#f0ece4" roughness={0.95} />;

  if (layout === 'circular') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[11, 64]} />
          {floorMat}
        </mesh>
        <mesh>
          <cylinderGeometry args={[11, 11, H, 64, 1, true]} />
          <meshStandardMaterial color="#e8e0d0" roughness={0.9} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[11, 64]} />
          {ceilMat}
        </mesh>
      </group>
    );
  }

  const hw = W / 2, hd = D / 2;
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        {floorMat}
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        {ceilMat}
      </mesh>
      {/* Walls */}
      <mesh position={[0, H / 2, -hd]}>
        <planeGeometry args={[W, H]} />
        {wallMat}
      </mesh>
      <mesh position={[0, H / 2, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        {wallMat}
      </mesh>
      <mesh position={[-hw, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        {wallMat}
      </mesh>
      <mesh position={[hw, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        {wallMat}
      </mesh>
      {/* Skirting / floor trim */}
      <mesh position={[0, 0.05, -hd + 0.03]}>
        <boxGeometry args={[W, 0.1, 0.06]} />
        <meshStandardMaterial color="#a89070" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.05, hd - 0.03]}>
        <boxGeometry args={[W, 0.1, 0.06]} />
        <meshStandardMaterial color="#a89070" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ─── Artifact display ──────────────────────────────────────────────────────────
function ArtifactObject({ placement, onNear }: { placement: MuseumArtifactPlacement; onNear: (p: MuseumArtifactPlacement | null) => void }) {
  const { camera } = useThree();
  const nearRef = useRef(false);

  // Never load an arbitrary URL supplied by another museum owner.
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const safeImage = normalizeStoredMuseumImage(placement.artifactImage);
    let active = true;
    setTexture(null);
    if (!safeImage) return;
    const loaded = new THREE.TextureLoader().load(safeImage,
      (ready) => { if (active) setTexture(ready); else ready.dispose(); },
      undefined,
      () => { if (active) setTexture(null); });
    return () => { active = false; loaded.dispose(); };
  }, [placement.artifactImage]);

  useFrame(() => {
    const dist = camera.position.distanceTo(
      new THREE.Vector3(placement.position.x, 0, placement.position.z)
    );
    if (dist < 3.5 && !nearRef.current) {
      nearRef.current = true;
      onNear(placement);
    } else if (dist >= 3.5 && nearRef.current) {
      nearRef.current = false;
      onNear(null);
    }
  });

  const { x, z } = placement.position;
  const title = placement.artifactData?.title || '—';
  const period = placement.artifactData?.dating?.period || '';

  // Determine facing direction (face center for circular, else face front for others)
  const lookAt = new THREE.Vector3(0, 0, 0);
  const pos2D = new THREE.Vector2(x, z);
  const angle = Math.atan2(-pos2D.x, -pos2D.y);

  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      {/* Pedestal base */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 1, 20]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Pedestal top plate */}
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[0.95, 0.04, 0.95]} />
        <meshStandardMaterial color="#6B5335" roughness={0.6} />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 2.3, 0.05]} castShadow>
        <boxGeometry args={[1.25, 1.6, 0.07]} />
        <meshStandardMaterial color="#3A2A1A" roughness={0.5} metalness={0.15} />
      </mesh>
      {/* Image plane */}
      <mesh position={[0, 2.3, 0.095]}>
        <planeGeometry args={[1.1, 1.4]} />
        {texture
          ? <meshBasicMaterial map={texture} />
          : <meshStandardMaterial color="#4A3728" roughness={0.8} />
        }
      </mesh>
      {/* Gold frame border */}
      {[[-0.55, 0], [0.55, 0], [0, -0.72], [0, 0.72]].map(([ox, oz], i) => (
        <mesh key={i} position={[ox as number, 2.3, 0.09]}>
          <boxGeometry args={[Math.abs(ox as number) > 0.1 ? 0.08 : 1.22, Math.abs(oz as number) > 0.1 ? 0.08 : 1.6, 0.02]} />
          <meshStandardMaterial color="#C9A84C" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {/* Label below frame */}
      <Html position={[0, 1.3, 0.15]} center distanceFactor={5} style={{ pointerEvents: 'none', width: 200 }}>
        <div className="bg-stone-900/90 backdrop-blur border border-stone-700 rounded-lg px-3 py-1.5 text-center shadow-lg" style={{ transform: 'scale(1)' }}>
          <p className="text-white text-xs font-bold leading-tight mb-0.5 line-clamp-2">{title}</p>
          {period && <p className="text-amber-400 text-[10px] uppercase tracking-widest">{period}</p>}
        </div>
      </Html>
    </group>
  );
}

// ─── Ambient lighting & spotlights per artifact ────────────────────────────────
function ArtifactLights({ artifacts }: { artifacts: MuseumArtifactPlacement[] }) {
  return (
    <>
      {artifacts.map((a, i) => (
        <spotLight
          key={a.id}
          position={[a.position.x, 3.5, a.position.z]}
          target-position={[a.position.x, 1, a.position.z]}
          intensity={1.5}
          angle={0.35}
          penumbra={0.6}
          castShadow={i < 6} // limit shadow casters
          color="#fff8e0"
        />
      ))}
    </>
  );
}

// ─── First-person controls ─────────────────────────────────────────────────────
interface FPSMovementProps {
  speed?: number;
  joystick: React.MutableRefObject<{ x: number; y: number }>;
  layout: MuseumRoom['layout'];
}

function FPSMovement({ speed = 6, joystick, layout }: FPSMovementProps) {
  const { camera } = useThree();
  const keys = useRef<{ [k: string]: boolean }>({});

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((_, delta) => {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    const s = speed * delta;

    if (keys.current['KeyW'] || keys.current['ArrowUp'])    camera.position.addScaledVector(fwd, s);
    if (keys.current['KeyS'] || keys.current['ArrowDown'])  camera.position.addScaledVector(fwd, -s);
    if (keys.current['KeyA'] || keys.current['ArrowLeft'])  camera.position.addScaledVector(right, -s);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) camera.position.addScaledVector(right, s);

    // Joystick (mobile)
    if (Math.abs(joystick.current.x) > 0.1 || Math.abs(joystick.current.y) > 0.1) {
      camera.position.addScaledVector(right, joystick.current.x * s * 1.5);
      camera.position.addScaledVector(fwd, -joystick.current.y * s * 1.5);
    }

    // Keep at eye height & clamp to room
    camera.position.y = 1.6;
    const bound = layout === 'gallery' ? { x: 13, z: 4 } : layout === 'circular' ? { r: 9.5 } : { x: 9.5, z: 9.5 };
    if ('r' in bound) {
      const d = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
      if (d > bound.r) {
        camera.position.x *= bound.r / d;
        camera.position.z *= bound.r / d;
      }
    } else {
      camera.position.x = Math.max(-bound.x, Math.min(bound.x, camera.position.x));
      camera.position.z = Math.max(-bound.z, Math.min(bound.z, camera.position.z));
    }
  });

  return null;
}

// ─── XR bridge ────────────────────────────────────────────────────────────────
function XRBridge({ onChange }: { onChange: (active: boolean) => void }) {
  const xr = useXR();
  const prev = useRef(false);
  useFrame(() => {
    const active = !!xr.session;
    if (active !== prev.current) { prev.current = active; onChange(active); }
  });
  return null;
}

// ─── Mobile joystick ──────────────────────────────────────────────────────────
function Joystick({ joystick }: { joystick: React.MutableRefObject<{ x: number; y: number }> }) {
  const baseRef  = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const ptId     = useRef<number | null>(null);
  const baseCenter = useRef({ x: 0, y: 0 });
  const MAX_R = 35;

  const onStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptId.current = e.pointerId;
    const rect = baseRef.current!.getBoundingClientRect();
    baseCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerId !== ptId.current) return;
    const dx = e.clientX - baseCenter.current.x;
    const dy = e.clientY - baseCenter.current.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_R);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * dist, ny = Math.sin(angle) * dist;
    if (stickRef.current) stickRef.current.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    joystick.current = { x: nx / MAX_R, y: ny / MAX_R };
  };

  const onEnd = () => {
    ptId.current = null;
    if (stickRef.current) stickRef.current.style.transform = 'translate(-50%, -50%)';
    joystick.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={baseRef}
      className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 relative touch-none"
      onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}
    >
      <div ref={stickRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/40 border border-white/60 shadow-lg" />
    </div>
  );
}

// ─── Scene ─────────────────────────────────────────────────────────────────────
function Scene({
  room, artifacts, joystick,
  onNear,
}: {
  room: MuseumRoom;
  artifacts: MuseumArtifactPlacement[];
  joystick: React.MutableRefObject<{ x: number; y: number }>;
  onNear: (p: MuseumArtifactPlacement | null) => void;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={75} />
      <ambientLight intensity={0.5} />
      <ArtifactLights artifacts={artifacts} />
      <RoomMesh layout={room.layout} />
      {artifacts.map(a => (
        <ArtifactObject key={a.id} placement={a} onNear={onNear} />
      ))}
      <PointerLockControls />
      <FPSMovement joystick={joystick} layout={room.layout} />
      <Environment preset="apartment" />
    </>
  );
}

// ─── Main viewer ──────────────────────────────────────────────────────────────
interface Props {
  roomId: string;
}

export const MuseumViewer: React.FC<Props> = ({ roomId }) => {
  const { setAppMode } = useUIStore();
  const { updateState } = useAppStore();
  const { lang } = useUIStore();
  const tr = lang === 'tr';
  const museum = useMuseum();

  const [room, setRoom]           = useState<MuseumRoom | null>(null);
  const [artifacts, setArtifacts] = useState<MuseumArtifactPlacement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [locked, setLocked]       = useState(false);

  // Pointer lock change listener
  useEffect(() => {
    const handler = () => setLocked(document.pointerLockElement instanceof HTMLCanvasElement);
    document.addEventListener('pointerlockchange', handler);
    return () => document.removeEventListener('pointerlockchange', handler);
  }, []);
  const [nearby, setNearby]       = useState<MuseumArtifactPlacement | null>(null);
  const [vrActive, setVrActive]   = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [isMobile, setIsMobile]   = useState(false);
  const joystick = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setIsMobile('ontouchstart' in window);
    navigator.xr?.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([museum.getRoom(roomId), museum.getRoomArtifacts(roomId)]).then(([r, arts]) => {
      if (cancelled) return;
      setRoom(r);
      setArtifacts(arts || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const openDetail = useCallback(() => {
    if (!nearby) return;
    updateState({ result: nearby.artifactData, ...artifactImageState(nearby.artifactImage || null), restoredImage: null });
    setAppMode('main');
  }, [nearby, updateState, setAppMode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-sm text-stone-400">{tr ? 'Oda yükleniyor...' : 'Loading room...'}</span>
      </div>
    );
  }

  if (!room) return (
    <div className="text-center py-20 text-red-400">{tr ? 'Oda bulunamadı.' : 'Room not found.'}</div>
  );

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setAppMode('museum-edit')} className="w-8 h-8 bg-stone-900/80 backdrop-blur border border-stone-700 rounded-full flex items-center justify-center text-stone-300 hover:text-white transition-colors">
            <ArrowLeft size={14} />
          </button>
          <span className="bg-stone-900/80 backdrop-blur border border-stone-700 text-stone-300 text-[10px] font-bold px-3 py-1.5 rounded-full">
            {room.name}
          </span>
          <span className="bg-stone-900/70 backdrop-blur text-stone-500 text-[10px] px-2 py-1 rounded-full">
            {artifacts.length} {tr ? 'eser' : 'artifacts'}
          </span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {vrSupported && !vrActive && (
            <button
              onClick={() => xrStore.enterVR()}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors"
            >
              <Glasses size={12} /> VR
            </button>
          )}
          {vrActive && (
            <button onClick={() => xrStore.getState().session?.end()} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">
              {tr ? 'VR Çıkış' : 'Exit VR'}
            </button>
          )}
        </div>
      </div>

      {/* Click to lock hint */}
      {!locked && !isMobile && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-stone-900/80 backdrop-blur border border-stone-700 text-stone-300 text-sm px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
            <Eye size={16} className="text-amber-400" />
            {tr ? 'Görmek için tıklayın · WASD ile yürü · ESC ile çık' : 'Click to look · WASD to walk · ESC to exit'}
          </div>
        </div>
      )}

      {/* Nearby artifact prompt */}
      {nearby && locked && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-auto animate-fade-in">
          <button
            onClick={openDetail}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-6 py-3 rounded-full shadow-2xl transition-all"
          >
            <ExternalLink size={16} />
            {tr ? 'Detayları Gör' : 'View Details'} — {nearby.artifactData?.title?.slice(0, 30)}
          </button>
        </div>
      )}

      {/* Crosshair */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-4 h-4 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/60" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/60" />
          </div>
        </div>
      )}

      {/* Mobile joystick */}
      {isMobile && (
        <div className="absolute bottom-6 left-6 z-20">
          <Joystick joystick={joystick} />
        </div>
      )}

      {/* Share URL */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
        <button
          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/museum/${roomId}`); }}
          className="text-[10px] font-bold text-stone-500 hover:text-stone-300 bg-stone-900/70 border border-stone-700 px-3 py-1.5 rounded-full transition-colors"
        >
          {tr ? 'Bağlantıyı Kopyala' : 'Copy Link'}
        </button>
      </div>

      {/* Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true }}
        onClick={() => {
          if (!locked) {
            const c = document.querySelector('canvas');
            c?.requestPointerLock();
          }
        }}
        style={{ borderRadius: '1rem', cursor: locked ? 'none' : 'pointer' }}
      >
        <XR store={xrStore}>
          <XRBridge onChange={setVrActive} />
          <Suspense fallback={null}>
            {vrActive ? (
              <>
                <XROrigin position={[0, 0, 0]} />
                <RoomMesh layout={room.layout} />
                {artifacts.map(a => (
                  <ArtifactObject key={a.id} placement={a} onNear={() => {}} />
                ))}
                <ambientLight intensity={0.7} />
                <ArtifactLights artifacts={artifacts} />
                <Environment preset="apartment" />
              </>
            ) : (
              <Scene room={room} artifacts={artifacts} joystick={joystick} onNear={setNearby} />
            )}
          </Suspense>
        </XR>
      </Canvas>
    </div>
  );
};
