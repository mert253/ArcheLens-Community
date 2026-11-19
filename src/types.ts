export interface Log {
  time: string;
  severity?: 'info' | 'warn' | 'error';
  msg: string;
  meta?: Record<string, unknown>;
}

export interface Inscription {
  original: string;
  translation: string;
  notes: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SimilarArtifact {
  name: string;
  museum: string;
  similarity: string;
}

export interface AnalysisResult {
  title: string;
  confidence_score: number;
  origin: { region: string; culture: string };
  dating: { period: string; date_range: string; century: string };
  specs: { style: string; material: string; technique: string; dimensions: string };
  analysis: {
    description: string;
    iconography: string;
    inscription: Inscription | null
  };
  preservation: { condition: string; damages: string };
  fun_fact: string;
  curator_note: string;
  location?: string;
  groundingUrls?: GroundingSource[];
  // Extended detail fields
  historical_context?: string;
  cultural_significance?: string;
  similar_artifacts?: SimilarArtifact[];
  production_technique_detail?: string;
  symbolism?: string;
  coordinates?: [number, number];
  current_location?: {
    museum: string;
    city: string;
    country: string;
    coordinates: [number, number];
  };
  bounding_boxes?: {
    label: string;
    description: string;
    box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized to 0-1000
  }[];
  digital_reconstruction?: string;
  // Inventory sheet (auto-generated alongside analysis)
  inventory?: InventoryData;
}

// ─── Inventory ─────────────────────────────────────────────────────────────────
export interface InventoryData {
  type: string;                         // Eser türü (kap, heykel, tablet…)
  period: string;                       // Dönem özeti
  material: string;                     // Malzeme listesi
  condition: string;                    // Durum kodu (A/B/C/D)
  dimensions_estimate: string;          // Tahmini ölçü
  preservation_recommendation: string;  // Koruma tavsiyesi
  catalog_id_suggestion: string;        // Önerilen katalog no
}

// ─── Evidence-Based Restoration ────────────────────────────────────────────────
export interface EvidenceRef {
  name: string;       // Referans eser adı
  museum: string;     // Bulunduğu müze
  similarity: string; // "%X örtüşüyor" formatında
  detail: string;     // Kanıt açıklaması
}

export interface RestorationEvidence {
  evidenceRefs: EvidenceRef[];
  confidenceScore: number; // 0-100
  hasEvidence: boolean;
}

// ─── Epigraphy / Faint Trace Detection ─────────────────────────────────────────
export interface EpigraphyDetection {
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 normalized
  charSuggestion: string;
  confidence: number; // 0-100
  positionLabel: string;
}

export interface CompareResult {
  similarity_score: number;
  conclusion: string; // Genel özet
  differences: string[]; // Farklılıklar (madde madde)
  similarities: string[]; // Benzerlikler (madde madde)
  era_match: boolean; // Aynı döneme ait mi?
  authenticity_analysis: string; // Orijinal / Replika analizi
  style_differences: string; // Stilistik farklar
}

export interface ElectronAnalysisRecord extends HistoryEntry {
  title: string;
  synced: boolean;
}

export interface SaveAnalysisPayload {
  id: string;
  title: string;
  thumbnail: string;
  resultJson: string;
  inventoryData: string | null;
}

// History entry stored in IndexedDB
export interface HistoryEntry {
  id: string;
  timestamp: number;
  imageDataUrl: string;       // thumbnail
  result: AnalysisResult;
  restoredImageUrl?: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// i18n
export type Language = 'tr' | 'en';

export interface Translations {
  [key: string]: string;
}

export interface RestorationResponse {
  restoredImage: string;
  explanation?: string;
  status: string;
}

// Theme
export type Theme = 'light' | 'dark';

// ─── Cross-Reference / RAG ─────────────────────────────────────────────────────
export interface CrossRefItem {
  title: string;
  date: string;
  culture: string;
  imageUrl: string;
  sourceUrl: string;
  museum: string;
}

// ─── Potsherd Matching ──────────────────────────────────────────────────────────
export interface PotsherdFile {
  id: string;
  name: string;
  url: string; // object URL for display
}

export interface PotsherdMatch {
  id: string;         // `${a}-${b}`
  a: string;          // file id
  b: string;          // file id
  nameA: string;
  nameB: string;
  edgeSim: number;    // 0-1
  textureSim: number; // 0-1
  score: number;      // 0.4*edge + 0.6*texture
  marked: boolean;    // user marked as "same vessel"
}

export interface PotsherdMatchRecord {
  id: string;
  pieceA: string;
  pieceB: string;
  score: number;
  edgeSim: number;
  textureSim: number;
  marked: number;     // 0 | 1 for SQLite/Dexie compat
  createdAt: number;
}

// ─── Collaboration ─────────────────────────────────────────────────────────────
export interface CollabUser {
  userId: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
}

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: DrawPoint[];
}

export interface StoredAnnotation {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  type: 'draw' | 'text' | 'marker';
  data: any;
  createdAt: string;
}

export interface AnalysisWorkspace {
  id: string;
  ownerId: string;
  title: string;
  resultJson: AnalysisResult;
  imageUrl?: string;
  createdAt: string;
}

// ─── Virtual Museum ────────────────────────────────────────────────────────────
export type RoomLayout = 'square' | 'gallery' | 'circular';

export interface Museum {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
}

export interface MuseumRoom {
  id: string;
  museumId: string;
  name: string;
  layout: RoomLayout;
  isPublic: boolean;
  createdAt: string;
}

export interface MuseumArtifactPlacement {
  id: string;
  roomId: string;
  artifactId: string;
  artifactData: AnalysisResult;
  artifactImage?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}
