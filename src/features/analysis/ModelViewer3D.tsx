import React, { Suspense, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Html, PerspectiveCamera } from '@react-three/drei';
import {
  createXRStore,
  XR,
  useXR,
  useXRHitTest,
  XROrigin,
} from '@react-three/xr';
import * as THREE from 'three';
import { Maximize2, Minimize2, Box, Glasses, Smartphone, X } from 'lucide-react';
import { AnalysisResult, Language } from '../../types';

// ─── XR store (singleton per component mount) ────────────────────────────────
const xrStore = createXRStore({
  hand: true,
  controller: true,
});

// ─── GLB Model ───────────────────────────────────────────────────────────────
function GlbModel({ url, scale = 1 }: { url: string; scale?: number }) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });

  return (
    <primitive
      ref={ref}
      object={scene}
      scale={scale}
      position={[0, 0, 0]}
    />
  );
}

// ─── AR hit-test reticle + placement ─────────────────────────────────────────
const matHelper = new THREE.Matrix4();

function ARScene({ glbUrl }: { glbUrl: string }) {
  const [placed, setPlaced] = useState(false);
  const [position, setPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const reticleRef = useRef<THREE.Mesh>(null);
  const { scene } = useGLTF(glbUrl);

  useXRHitTest(
    (results, getWorldMatrix) => {
      if (results.length === 0) return;
      getWorldMatrix(matHelper, results[0]);
      const pos = new THREE.Vector3().setFromMatrixPosition(matHelper);
      if (reticleRef.current) {
        reticleRef.current.position.copy(pos);
        reticleRef.current.visible = true;
      }
    },
    'viewer',
    ['plane', 'mesh']
  );

  const handleTap = useCallback(() => {
    if (reticleRef.current?.visible) {
      setPosition(reticleRef.current.position.clone());
      setPlaced(true);
    }
  }, []);

  return (
    <group onClick={handleTap}>
      {/* Reticle ring */}
      <mesh ref={reticleRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.08, 32]} />
        <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} />
      </mesh>

      {/* Placed model */}
      {placed && (
        <primitive
          object={scene.clone()}
          position={position}
          scale={0.3}
        />
      )}

      {/* Tap-to-place hint */}
      {!placed && (
        <Html center position={[0, 0.5, -1]}>
          <div className="bg-stone-900/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
            Yüzeye dokunun / Tap surface to place
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── VR Scene with floating labels ───────────────────────────────────────────
function VRScene({ glbUrl, result }: { glbUrl: string; result: AnalysisResult }) {
  const { scene } = useGLTF(glbUrl);

  return (
    <>
      <XROrigin position={[0, -1.6, -2]} />
      <primitive object={scene} scale={0.5} position={[0, 0, -2]} />
      {/* Floating info labels */}
      <Html position={[-0.8, 0.6, -2]} center>
        <div className="bg-stone-900/90 text-white text-[10px] px-2 py-1 rounded-lg border border-amber-500/40 max-w-[120px] text-center backdrop-blur">
          <span className="text-amber-400 font-bold block">{result.dating?.period || '—'}</span>
          <span className="text-stone-300">{result.specs?.material || '—'}</span>
        </div>
      </Html>
    </>
  );
}

// ─── Session state reader (inside Canvas) ────────────────────────────────────
function XRSessionBridge({
  onSessionChange,
}: {
  onSessionChange: (mode: string | null) => void;
}) {
  const xrState = useXR();
  const prevMode = useRef<string | null>(null);

  useFrame(() => {
    const session = xrState.session;
    const mode = session ? (xrState as any).mode ?? 'immersive-ar' : null;
    if (mode !== prevMode.current) {
      prevMode.current = mode;
      onSessionChange(mode);
    }
  });

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
interface ModelViewer3DProps {
  glbUrl: string;
  result: AnalysisResult;
  lang: Language;
  onClose: () => void;
}

export const ModelViewer3D: React.FC<ModelViewer3DProps> = ({ glbUrl, result, lang, onClose }) => {
  const tr = lang === 'tr';
  const [xrMode, setXrMode] = useState<'ar' | 'vr' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [vrSupported, setVrSupported] = useState<boolean | null>(null);

  // Check WebXR support
  React.useEffect(() => {
    if (!navigator.xr) {
      setArSupported(false);
      setVrSupported(false);
      return;
    }
    navigator.xr.isSessionSupported('immersive-ar').then(setArSupported).catch(() => setArSupported(false));
    navigator.xr.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => setVrSupported(false));
  }, []);

  const enterAR = () => {
    xrStore.enterAR();
    setXrMode('ar');
  };

  const enterVR = () => {
    xrStore.enterVR();
    setXrMode('vr');
  };

  const exitXR = () => {
    xrStore.getState().session?.end();
    setXrMode(null);
  };

  return (
    <div
      className={`relative bg-stone-900 rounded-2xl overflow-hidden border border-[var(--border-primary)]
        ${fullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'w-full aspect-video'}`}
    >
      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="bg-stone-900/80 backdrop-blur text-amber-400 text-[10px] font-bold px-3 py-1.5 rounded-full border border-amber-500/30 flex items-center gap-1.5">
            <Box className="w-3 h-3" />
            {tr ? '3D Görüntüleyici' : '3D Viewer'}
          </span>
          {xrMode && (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-500/40">
              {xrMode === 'ar' ? 'AR' : 'VR'} •{tr ? ' Aktif' : ' Active'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setFullscreen(f => !f)}
            className="w-7 h-7 bg-stone-800/80 hover:bg-stone-700 backdrop-blur rounded-full flex items-center justify-center transition-colors border border-stone-600/40"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5 text-stone-300" /> : <Maximize2 className="w-3.5 h-3.5 text-stone-300" />}
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-stone-800/80 hover:bg-red-900/60 backdrop-blur rounded-full flex items-center justify-center transition-colors border border-stone-600/40"
          >
            <X className="w-3.5 h-3.5 text-stone-300" />
          </button>
        </div>
      </div>

      {/* Three.js Canvas */}
      <Canvas gl={{ antialias: true, alpha: true }} shadows>
        <PerspectiveCamera makeDefault position={[0, 0.5, 2]} fov={50} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <pointLight position={[-5, 3, -5]} intensity={0.4} color="#f59e0b" />

        <XR store={xrStore}>
          <XRSessionBridge onSessionChange={(m) => setXrMode(m as any)} />
          <Suspense fallback={null}>
            {xrMode === 'ar' ? (
              <ARScene glbUrl={glbUrl} />
            ) : xrMode === 'vr' ? (
              <VRScene glbUrl={glbUrl} result={result} />
            ) : (
              <GlbModel url={glbUrl} />
            )}
          </Suspense>
        </XR>

        <OrbitControls
          enablePan={false}
          minDistance={0.5}
          maxDistance={5}
          autoRotate={!xrMode}
          autoRotateSpeed={0.5}
        />
        <Environment preset="city" />
      </Canvas>

      {/* AR/VR controls */}
      {!xrMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          {arSupported && (
            <button
              onClick={enterAR}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs px-4 py-2 rounded-full transition-all shadow-lg"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {tr ? 'AR Modunu Aç' : 'Open AR'}
            </button>
          )}
          {vrSupported && (
            <button
              onClick={enterVR}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-4 py-2 rounded-full transition-all shadow-lg"
            >
              <Glasses className="w-3.5 h-3.5" />
              {tr ? 'VR Modunu Aç' : 'Open VR'}
            </button>
          )}
          {arSupported === false && vrSupported === false && (
            <span className="text-stone-400 text-[10px] bg-stone-800/80 px-3 py-1.5 rounded-full">
              {tr ? 'WebXR bu cihazda desteklenmiyor' : 'WebXR not supported on this device'}
            </span>
          )}
        </div>
      )}

      {xrMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={exitXR}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-full transition-all shadow-lg"
          >
            <X className="w-3.5 h-3.5" />
            {tr ? 'Çıkış' : 'Exit XR'}
          </button>
        </div>
      )}

      {/* Fallback loading */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Suspense fallback={
          <div className="text-stone-400 text-xs animate-pulse">
            {tr ? 'Model yükleniyor...' : 'Loading model...'}
          </div>
        }>
          {null}
        </Suspense>
      </div>
    </div>
  );
};
