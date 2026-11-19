import { create } from 'zustand';
import { Language, Theme } from '../types';

export type AppMode = 'main' | 'discover' | 'detective' | 'settings' | 'match' | 'photogrammetry' | 'workspace' | 'museum' | 'museum-edit';
export type TabKey = 'overview' | 'academic' | 'technical' | 'map' | 'timeline' | 'chat' | 'museum';
export type AIMode = 'online' | 'offline' | 'auto';

export interface UIState {
  activeTab: TabKey;
  appMode: AppMode;
  showHelp: boolean;
  showHistory: boolean;
  showShare: boolean;
  showMobileMenu: boolean;
  lang: Language;
  theme: Theme;
  aiMode: AIMode;
  resolvedAIMode: 'online' | 'offline';
  workspaceId: string | null;
  museumRoomId: string | null;
}

export interface UIActions {
  setAppMode: (mode: AppMode) => void;
  setActiveTab: (tab: TabKey) => void;
  setLang: (lang: Language) => void;
  toggleTheme: () => void;
  setShowHelp: (show: boolean) => void;
  setShowHistory: (show: boolean) => void;
  setShowShare: (show: boolean) => void;
  setShowMobileMenu: (show: boolean) => void;
  updateUI: (updates: Partial<UIState>) => void;
  setAIMode: (mode: AIMode) => void;
  setResolvedAIMode: (mode: 'online' | 'offline') => void;
}

const getInitialAIMode = (): AIMode => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('archelens-ai-mode') as AIMode) || 'online';
  }
  return 'online';
};

const getInitialLang = (): Language => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('archelens-lang') as Language) || 'tr';
  }
  return 'tr';
};

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('archelens-theme') as Theme;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  activeTab: 'overview',
  appMode: 'main',
  showHelp: false,
  showHistory: false,
  showShare: false,
  showMobileMenu: false,
  lang: getInitialLang(),
  theme: getInitialTheme(),
  aiMode: getInitialAIMode(),
  resolvedAIMode: 'online',
  workspaceId: null,
  museumRoomId: null,

  setAppMode: (appMode) => set({ appMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLang: (lang) => {
    localStorage.setItem('archelens-lang', lang);
    set({ lang });
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('archelens-theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    set({ theme: newTheme });
  },
  setShowHelp: (showHelp) => set({ showHelp }),
  setShowHistory: (showHistory) => set({ showHistory }),
  setShowShare: (showShare) => set({ showShare }),
  setShowMobileMenu: (showMobileMenu) => set({ showMobileMenu }),
  updateUI: (updates) => set(updates),
  setAIMode: (aiMode) => {
    localStorage.setItem('archelens-ai-mode', aiMode);
    // If not auto, resolved = mode itself
    const resolvedAIMode = aiMode !== 'auto' ? aiMode : get().resolvedAIMode;
    set({ aiMode, resolvedAIMode });
  },
  setResolvedAIMode: (resolvedAIMode) => set({ resolvedAIMode }),
}));
