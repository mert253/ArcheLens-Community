import { artifactService } from './artifactService';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { AnalysisResult } from '../types';
import { t } from '../i18n';

export const appService = {
  async handleAnalyze(file: File, addHistoryEntry?: (url: string, res: AnalysisResult) => void) {
    const store = useAppStore.getState();
    const uiStore = useUIStore.getState();
    const { addLog, updateState } = store;
    const { lang } = uiStore;

    updateState({ loading: true, error: null, result: null, restoredImage: null, systemLogs: [] });
    addLog('info', t('log.starting', lang));

    try {
      addLog('info', t('log.aiEngine', lang));
      const { base64, mimeType } = await artifactService.compressAndConvert(file);
      updateState({ imageBase64: base64, imageMimeType: mimeType });

      addLog('info', t('log.googleDb', lang));
      const res = await artifactService.analyze(base64, mimeType, lang);
      
      addLog('info', t('log.scanning', lang));
      addLog('info', "Analysis Result Received", { res });
      updateState({ result: res, loading: false });
      
      if (addHistoryEntry) {
        const url = URL.createObjectURL(file);
        addHistoryEntry(url, res);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateState({ error: t('error.analysis', lang) + errorMessage, loading: false });
    }
  },

  async handleRestore() {
    const store = useAppStore.getState();
    const uiStore = useUIStore.getState();
    const { imageBase64, imageMimeType, restorationMode, customPrompt, result, addLog, restoredImage, updateState } = store;
    const { lang } = uiStore;
    
    if (!imageBase64) return;

    if (restoredImage && restoredImage.startsWith('blob:')) {
      URL.revokeObjectURL(restoredImage);
    }

    updateState({ isRestoring: true, error: null });
    addLog('info', t('log.materialSpectrum', lang));

    try {
      const prompt = restorationMode === 'custom' 
        ? customPrompt 
        : `Restore this ${result?.title || 'artifact'} to its original state. Repair cracks, restore missing parts, and correct colors while maintaining structural accuracy.`;
      
      const restored = await artifactService.restore(imageBase64, imageMimeType, prompt);
      updateState({ restoredImage: restored, isRestoring: false, showComparison: true });
      addLog('info', t('log.restorationDone', lang));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateState({ error: t('error.restoration', lang) + errorMessage, isRestoring: false });
    }
  },

  async handleCompare(files: File[]) {
    const store = useAppStore.getState();
    const uiStore = useUIStore.getState();
    const { addLog, updateState } = store;
    const { lang, setAppMode } = uiStore;
    
    if (files.length !== 2) return;

    setAppMode('detective');
    updateState({ 
        loading: true, 
        error: null, 
        compareImages: files.map(f => URL.createObjectURL(f)) 
    });
    
    addLog('info', lang === 'tr' ? 'Detektif modu başlatılıyor...' : 'Detective mode starting...');

    try {
      const processedFiles = await Promise.all(files.map(f => artifactService.compressAndConvert(f)));
      const base64Files = processedFiles.map(pf => ({ base64Data: pf.base64, mimeType: pf.mimeType }));
      
      const res = await artifactService.compare(base64Files, lang);
      updateState({ compareResult: res, loading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateState({ error: errorMessage, loading: false });
    }
  },

};
