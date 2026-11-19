import imageCompression from 'browser-image-compression';
import { analyzeArtifact, restoreArtifact, compareArtifacts } from '../lib/api';
import { analyzeWithWebLLM } from '../lib/webllm';
import { useUIStore } from '../store/useUIStore';
import { AnalysisResult, Language } from '../types';

export const artifactService = {
  async compressAndConvert(file: File): Promise<{ base64: string; mimeType: string }> {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);
    const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
    return {
      base64: base64.split(',')[1],
      mimeType: compressedFile.type
    };
  },

  async analyze(base64: string, mimeType: string, lang: Language, cvSummary?: string): Promise<AnalysisResult> {
    const { resolvedAIMode } = useUIStore.getState();
    if (resolvedAIMode === 'offline') {
      return analyzeWithWebLLM(base64, mimeType, lang);
    }
    return await analyzeArtifact(base64, mimeType, lang, cvSummary);
  },

  async restore(base64: string, mimeType: string, prompt: string, expectedUserId?: string | null): Promise<any> {
    return await restoreArtifact(base64, mimeType, prompt, expectedUserId);
  },

  async compare(files: { base64Data: string; mimeType: string }[], lang: Language) {
    return await compareArtifacts(files, lang);
  },

};
