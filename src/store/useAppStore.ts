import { create } from 'zustand';
import { AnalysisResult, Log, CompareResult, EvidenceRef, EpigraphyDetection } from '../types';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AppState {
  session: Session | null;
  user: User | null;
  authLoading: boolean;

  image: string | null;
  imageBase64: string | null;
  imageMimeType: string;
  loading: boolean;
  result: AnalysisResult | null;
  error: string | null;
  systemLogs: Log[];
  restoredImage: string | null;
  isRestoring: boolean;
  showComparison: boolean;
  restorationMode: 'auto' | 'custom';
  customPrompt: string;
  compareResult: CompareResult | null;
  compareImages: string[];

  // Evidence-based restoration
  evidenceRefs: EvidenceRef[];
  restoreConfidenceScore: number;
  hasEvidence: boolean;

  // Epigraphy mode
  epigraphyMode: boolean;
  epigraphyDetections: EpigraphyDetection[];
  epigraphyImage: string | null;  // CLAHE-processed image (base64 data URL)
  epigraphyLoading: boolean;

  // CV preprocessing summary (prepended to LLM prompt)
  cvSummary: string | null;
  // CV overlay visuals
  cvOverlayDataUrl: string | null;    // Canny red + contour yellow bbox overlay
  cvRegionMapDataUrl: string | null;  // k-means color segmentation map

  // 3D / Photogrammetry
  glbModelUrl: string | null;  // URL to .glb model for 3D viewer
}

export interface AppActions {
  initializeAuth: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  updateState: (updates: Partial<AppState>) => void;
  addLog: (
    severityOrMsg: 'info' | 'warn' | 'error' | string,
    msg?: string,
    meta?: Record<string, unknown>
  ) => void;
  resetApp: () => void;
  revokeUrls: () => void;
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // Initial State
  session: null,
  user: null,
  authLoading: true,

  image: null,
  imageBase64: null,
  imageMimeType: 'image/jpeg',
  loading: false,
  result: null,
  error: null,
  systemLogs: [],
  restoredImage: null,
  isRestoring: false,
  showComparison: false,
  restorationMode: 'auto',
  customPrompt: '',
  compareResult: null,
  compareImages: [],

  evidenceRefs: [],
  restoreConfidenceScore: 0,
  hasEvidence: false,

  epigraphyMode: false,
  epigraphyDetections: [],
  epigraphyImage: null,
  epigraphyLoading: false,

  cvSummary: null,
  cvOverlayDataUrl: null,
  cvRegionMapDataUrl: null,
  glbModelUrl: null,

  // Auth Actions
  initializeAuth: () => {
    if (!isSupabaseConfigured) { set({ authLoading: false }); return; }
    let receivedAuthEvent = false;
    const applySession = (session: Session | null) => {
      const user = session?.user ?? null;
      const previousUser = get().user;
      if (previousUser && previousUser.id !== user?.id) {
        get().revokeUrls();
        get().resetApp();
      }
      set({ session, user, authLoading: false });
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!receivedAuthEvent) applySession(session);
    }).catch(() => { if (!receivedAuthEvent) applySession(null); });
    supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      applySession(session);
    });
  },
  signInWithGoogle: async () => {
    const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });
    if (error) throw error;
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Data Actions
  updateState: (updates) => set(updates),
  addLog: (severityOrMsg, msg, meta) => set((state) => {
    const isSeverity = msg !== undefined && (severityOrMsg === 'info' || severityOrMsg === 'warn' || severityOrMsg === 'error');
    const severity = isSeverity ? (severityOrMsg as 'info' | 'warn' | 'error') : 'info';
    const message = isSeverity ? msg! : severityOrMsg;
    return {
      systemLogs: [...state.systemLogs, { time: new Date().toLocaleTimeString(), severity, msg: message, ...(meta ? { meta } : {}) }]
    };
  }),
  resetApp: () => set({
    image: null,
    imageBase64: null,
    result: null,
    error: null,
    loading: false,
    systemLogs: [],
    restoredImage: null,
    showComparison: false,
    compareResult: null,
    compareImages: [],
    evidenceRefs: [],
    restoreConfidenceScore: 0,
    hasEvidence: false,
    epigraphyMode: false,
    epigraphyDetections: [],
    epigraphyImage: null,
    epigraphyLoading: false,
    cvSummary: null,
    cvOverlayDataUrl: null,
    cvRegionMapDataUrl: null,
    glbModelUrl: null,
  }),
  revokeUrls: () => {
    const { image, restoredImage, compareImages } = get();
    if (image?.startsWith('blob:')) URL.revokeObjectURL(image);
    if (restoredImage?.startsWith('blob:')) URL.revokeObjectURL(restoredImage);
    compareImages.forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }
}));
