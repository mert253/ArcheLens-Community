import { API_BASE } from '../lib/config';
import { getAuthHeaders } from '../lib/api';
import { useMutation } from '@tanstack/react-query';
import { artifactService } from '../services/artifactService';
import { useAppStore } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { Language } from '../types';
import { t } from '../i18n';
import { runPreAnalyze, pixelsToDataUrl, runCLAHE } from '../lib/cvAnalysis';

export function captureArtifactPrincipal() {
  const { user, authRevision } = useAppStore.getState();
  return { userId: user?.id ?? null, authRevision };
}

type ArtifactPrincipal = ReturnType<typeof captureArtifactPrincipal>;
type ImageSelection = ArtifactPrincipal & { image: string | null };

function isCurrentArtifactPrincipal(principal: ArtifactPrincipal) {
  const current = captureArtifactPrincipal();
  return principal.userId === current.userId && principal.authRevision === current.authRevision;
}

export function isCurrentImageSelection(selection: ImageSelection) {
  return isCurrentArtifactPrincipal(selection) && selection.image === useAppStore.getState().image;
}

function captureArtifactSelection() {
  const { image, imageBase64 } = useAppStore.getState();
  return { ...captureArtifactPrincipal(), image, imageBase64 };
}

function isCurrentArtifact(selection?: ReturnType<typeof captureArtifactSelection>) {
  return selection && isCurrentImageSelection(selection) && selection.imageBase64 === useAppStore.getState().imageBase64;
}

function requireCurrentArtifact(selection: ReturnType<typeof captureArtifactSelection>) {
  if (!isCurrentArtifact(selection)) throw new DOMException('The active artifact changed.', 'AbortError');
}

function requireCurrentAnalysis(selection: ImageSelection) {
  if (!isCurrentImageSelection(selection)) throw new DOMException('The active artifact changed.', 'AbortError');
}

function requireCurrentPrincipal(principal: ArtifactPrincipal) {
  if (!isCurrentArtifactPrincipal(principal)) throw new DOMException('The active account changed.', 'AbortError');
}

export function useAnalyzeArtifact() {
  return useMutation({
    mutationKey: ['analyze'],
    mutationFn: async ({ file, lang, selection }: { file: File; lang: Language; selection: ImageSelection & { image: string } }) => {
      requireCurrentAnalysis(selection);
      const { base64, mimeType } = await artifactService.compressAndConvert(file);
      requireCurrentAnalysis(selection);
      useAppStore.getState().updateState({ imageBase64: base64, imageMimeType: mimeType });

      // ── Faz 4: CV pre-analysis (3s timeout — non-blocking on failure) ──
      let cvSummary: string | undefined;
      try {
        const cvResult = await runPreAnalyze(selection.image);
        requireCurrentAnalysis(selection);
        cvSummary = cvResult.summary;
        // Store overlay + region map for display
        const overlayDataUrl = pixelsToDataUrl(cvResult.overlayPixels, cvResult.w, cvResult.h);
        const regionMapDataUrl = cvResult.regionMapPixels?.length
          ? pixelsToDataUrl(cvResult.regionMapPixels, cvResult.w, cvResult.h)
          : null;
        useAppStore.getState().updateState({
          cvSummary,
          cvOverlayDataUrl: overlayDataUrl,
          cvRegionMapDataUrl: regionMapDataUrl,
        });
        useAppStore.getState().addLog('info', `CV: ${cvResult.edgeCount} kenar, ${cvResult.contourCount} kontur tespiti`);
      } catch (cvErr) {
        requireCurrentAnalysis(selection);
        const errorMessage = cvErr instanceof Error ? cvErr.message : String(cvErr);
        // Silently skip CV error, do not show in logs to user as it is non-fatal
        console.warn('[CV] Pre-analysis failed (non-fatal)', { error: errorMessage });
      }

      requireCurrentAnalysis(selection);
      const res = await artifactService.analyze(base64, mimeType, lang, cvSummary, selection.userId);
      requireCurrentAnalysis(selection);
      return res;
    },
    onMutate: ({ selection }) => {
      if (!isCurrentImageSelection(selection)) return;
      const { updateState, addLog } = useAppStore.getState();
      const { lang, resolvedAIMode } = useUIStore.getState();
      updateState({ result: null, restoredImage: null, systemLogs: [], evidenceRefs: [], hasEvidence: false, cvSummary: null, cvOverlayDataUrl: null, cvRegionMapDataUrl: null });
      addLog('info', t('log.starting', lang));
      if (resolvedAIMode === 'offline') {
        addLog('info', lang === 'tr' ? '⚡ Çevrimdışı AI motoru (Phi-3-mini) aktif' : '⚡ Offline AI engine (Phi-3-mini) active');
      } else {
        addLog('info', t('log.aiEngine', lang));
      }
      useUIStore.getState().updateUI({ activeTab: 'overview' });
    },
    onSuccess: (data, { selection }) => {
      if (!isCurrentImageSelection(selection)) return;
      const { updateState, addLog } = useAppStore.getState();
      const { lang, resolvedAIMode } = useUIStore.getState();
      if (resolvedAIMode === 'offline') {
        addLog('info', lang === 'tr' ? 'Yerel model analizi tamamlandı' : 'Local model analysis complete');
      } else {
        addLog('info', t('log.googleDb', lang));
        addLog('info', t('log.scanning', lang));
      }
      updateState({ result: data });
    }
  });
}

// ─── Epigraphy mutation ───────────────────────────────────────────────────────
export function useEpigraphyAnalyze() {
  return useMutation({
    mutationKey: ['epigraphy'],
    onMutate: captureArtifactSelection,
    mutationFn: async () => {
      const selection = captureArtifactSelection();
      const { image, imageBase64 } = selection;
      const { lang } = useUIStore.getState();
      if (!image) throw new Error('Görsel yok');

      // Apply CLAHE enhancement
      useAppStore.getState().updateState({ epigraphyLoading: true });
      let claheDataUrl: string | null = null;
      let processedBase64 = imageBase64 || '';

      try {
        const claheResult = await runCLAHE(image);
        claheDataUrl = pixelsToDataUrl(claheResult.pixels, claheResult.w, claheResult.h);
        // Strip data URL prefix for API
        processedBase64 = claheDataUrl.split(',')[1];
      } catch (e) {
        requireCurrentArtifact(selection);
        const errorMessage = e instanceof Error ? e.message : String(e);
        useAppStore.getState().addLog('warn', '[CV] CLAHE failed, using original', { error: errorMessage });
      }

      const headers = await getAuthHeaders(true, selection.userId);
      requireCurrentArtifact(selection);
      const res = await fetch(`${API_BASE}/epigraphy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageData: processedBase64, lang }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      requireCurrentArtifact(selection);
      return { ...data, claheDataUrl };
    },
    onSuccess: (data: any, _variables, selection) => {
      if (!isCurrentArtifact(selection)) return;
      useAppStore.getState().updateState({
        epigraphyDetections: data.detections || [],
        epigraphyImage: data.claheDataUrl || null,
        epigraphyLoading: false,
      });
    },
    onError: (_error, _variables, selection) => {
      if (!isCurrentArtifact(selection)) return;
      useAppStore.getState().updateState({ epigraphyLoading: false });
    }
  });
}

export function useRestoreArtifact() {
  return useMutation({
    mutationKey: ['restore'],
    mutationFn: async () => {
      const selection = captureArtifactSelection();
      const { imageBase64, imageMimeType, restorationMode, customPrompt, result } = useAppStore.getState();
      if (!imageBase64) throw new Error("Görsel bulunamadı");
      const prompt = restorationMode === 'custom' 
        ? customPrompt 
        : `Restore this ${result?.title || 'artifact'} to its original state. Repair cracks, restore missing parts, and correct colors while maintaining structural accuracy.`;
      
      const restored = await artifactService.restore(imageBase64, imageMimeType, prompt, selection.userId);
      requireCurrentArtifact(selection);
      return restored;
    },
    onMutate: () => {
      const { restoredImage, addLog } = useAppStore.getState();
      const lang = useUIStore.getState().lang;
      if (restoredImage && restoredImage.startsWith('blob:')) {
        URL.revokeObjectURL(restoredImage);
      }
      addLog('info', t('log.materialSpectrum', lang));
      return captureArtifactSelection();
    },
    onSuccess: (data: any, _variables, selection) => {
      if (!isCurrentArtifact(selection)) return;
      const { updateState, addLog } = useAppStore.getState();
      const lang = useUIStore.getState().lang;
      updateState({
        restoredImage: data.imageGenerated ? data.restoredImage : null,
        showComparison: false,
        evidenceRefs: data.evidenceRefs || [],
        restoreConfidenceScore: data.evidenceConfidenceScore || 0,
        hasEvidence: data.hasEvidence || false,
      });
      addLog('info', t('log.restorationDone', lang));
      if (data.evidenceRefs?.length > 0) {
        addLog('info', lang === 'tr'
          ? `${data.evidenceRefs.length} referans eser bulundu`
          : `${data.evidenceRefs.length} reference artifact(s) found`);
      }
    }
  });
}

export function useCompareArtifacts() {
  return useMutation({
    mutationKey: ['compare'],
    mutationFn: async ({ files, principal }: { files: File[]; principal: ArtifactPrincipal }) => {
      requireCurrentPrincipal(principal);
      const { lang } = useUIStore.getState();
      const processFiles = await Promise.all(
        files.map(async f => artifactService.compressAndConvert(f))
      );
      requireCurrentPrincipal(principal);
      const res = await artifactService.compare(
        processFiles.map(pf => ({ base64Data: pf.base64, mimeType: pf.mimeType })),
        lang,
        principal.userId,
      );
      requireCurrentPrincipal(principal);
      return res;
    },
    onMutate: ({ files, principal }) => {
      if (!isCurrentArtifactPrincipal(principal)) return;
      const urls = files.map(f => URL.createObjectURL(f));
      useAppStore.getState().updateState({ 
        compareImages: urls,
        compareResult: null,
      });
      useUIStore.getState().setAppMode('detective');
      return urls;
    },
    onSuccess: (data, { principal }, urls) => {
      if (!isCurrentArtifactPrincipal(principal) || !urls || useAppStore.getState().compareImages !== urls) return;
      useAppStore.getState().updateState({ compareResult: data });
    }
  });
}
