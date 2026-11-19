import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import { DISCOVER_PINS, DiscoverPin } from '../data/discoverData';
import { useUIStore } from '../store/useUIStore';

// ── Convert lat/lng to 3D sphere position ──
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

// ── Single Pin on the globe ──
function GlobePin({ pin, isSelected, onClick }: {
    pin: DiscoverPin;
    isSelected: boolean;
    onClick: () => void;
}) {
    const position = useMemo(() => latLngToVector3(pin.lat, pin.lng, 2.02), [pin.lat, pin.lng]);
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.scale.setScalar(isSelected ? 1.5 + Math.sin(Date.now() * 0.005) * 0.3 : 1);
        }
    });

    return (
        <group>
            <mesh ref={meshRef} position={position} onClick={onClick}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshStandardMaterial
                    color={pin.color}
                    emissive={pin.color}
                    emissiveIntensity={isSelected ? 0.8 : 0.3}
                />
            </mesh>
            {/* Glow ring */}
            <mesh position={position}>
                <ringGeometry args={[0.05, 0.07, 32]} />
                <meshBasicMaterial color={pin.color} transparent opacity={isSelected ? 0.6 : 0.2} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}

// ── Rotating Globe ──
function Globe({ children }: { children: React.ReactNode }) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((_, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.05;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Earth sphere */}
            <Sphere args={[2, 64, 64]}>
                <meshStandardMaterial
                    color="#1a3a5c"
                    roughness={0.8}
                    metalness={0.1}
                    wireframe={false}
                />
            </Sphere>
            {/* Wireframe overlay for landmass feel */}
            <Sphere args={[2.005, 32, 32]}>
                <meshBasicMaterial
                    color="#2d6a9f"
                    wireframe
                    transparent
                    opacity={0.15}
                />
            </Sphere>
            {/* Atmosphere glow */}
            <Sphere args={[2.15, 32, 32]}>
                <meshBasicMaterial
                    color="#4a9eff"
                    transparent
                    opacity={0.05}
                    side={THREE.BackSide}
                />
            </Sphere>
            {children}
        </group>
    );
}

// ── Info Card (HTML overlay) ──
function PinInfoCard({ pin, onClose }: { pin: DiscoverPin; onClose: () => void }) {
    const lang = useUIStore((s) => s.lang);
    const position = useMemo(() => latLngToVector3(pin.lat, pin.lng, 2.3), [pin.lat, pin.lng]);

    return (
        <Html position={position} distanceFactor={5} zIndexRange={[100, 0]}>
            <div
                className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-4 shadow-2xl min-w-[220px] max-w-[260px] animate-fade-in"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                        {lang === 'tr' ? pin.title : pin.titleEn}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-lg leading-none ml-2"
                    >&times;</button>
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: pin.color }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                        {pin.period} • {pin.region}
                    </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {lang === 'tr' ? pin.description : pin.descriptionEn}
                </p>
            </div>
        </Html>
    );
}

// ── Main Component ──
export const DiscoverGlobe: React.FC = () => {
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const lang = useUIStore((s) => s.lang);

    const handlePinClick = useCallback((id: string) => {
        setSelectedPin((prev) => (prev === id ? null : id));
    }, []);

    const selectedPinData = useMemo(
        () => DISCOVER_PINS.find((p) => p.id === selectedPin),
        [selectedPin]
    );

    return (
        <div className="w-full h-full min-h-[500px] relative">
            {/* Header */}
            <div className="absolute top-6 left-6 z-10">
                <h2 className="text-2xl font-serif font-bold text-[var(--text-primary)] mb-1">
                    {lang === 'tr' ? '🌍 Keşfet' : '🌍 Discover'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] max-w-xs">
                    {lang === 'tr'
                        ? 'Dünya üzerindeki ünlü arkeolojik eserleri keşfedin. Pin\'lere tıklayarak detayları görün.'
                        : 'Explore famous archaeological artifacts around the world. Click pins for details.'}
                </p>
            </div>

            {/* Pin count badge */}
            <div className="absolute top-6 right-6 z-10 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-full">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                    {DISCOVER_PINS.length} {lang === 'tr' ? 'Eser' : 'Artifacts'}
                </span>
            </div>

            {/* 3D Canvas */}
            <Canvas
                camera={{ position: [0, 2, 5], fov: 45 }}
                style={{ background: 'transparent' }}
                gl={{ antialias: true, alpha: true }}
            >
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 3, 5]} intensity={1} />
                <pointLight position={[-5, -3, -5]} intensity={0.3} color="#4a9eff" />

                <Globe>
                    {DISCOVER_PINS.map((pin) => (
                        <GlobePin
                            key={pin.id}
                            pin={pin}
                            isSelected={selectedPin === pin.id}
                            onClick={() => handlePinClick(pin.id)}
                        />
                    ))}
                    {selectedPinData && (
                        <PinInfoCard pin={selectedPinData} onClose={() => setSelectedPin(null)} />
                    )}
                </Globe>

                <OrbitControls
                    enableZoom={true}
                    enablePan={false}
                    minDistance={3.5}
                    maxDistance={8}
                    autoRotate={!selectedPin}
                    autoRotateSpeed={0.3}
                    dampingFactor={0.05}
                    enableDamping
                />
            </Canvas>

            {/* Bottom legend */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-wrap justify-center gap-2 max-w-lg">
                {DISCOVER_PINS.slice(0, 6).map((pin) => (
                    <button
                        key={pin.id}
                        onClick={() => handlePinClick(pin.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium border transition-all ${selectedPin === pin.id
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                            }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pin.color }} />
                        {lang === 'tr' ? pin.title : pin.titleEn}
                    </button>
                ))}
            </div>
        </div>
    );
};
