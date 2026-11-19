import { useState, useCallback, useEffect, useRef } from 'react';
import { AnalysisResult, Language } from '../types';
import { useAppStore } from '../store/useAppStore';

export type AudioSpeed = 0.7 | 0.85 | 1.0 | 1.2 | 1.5;

export function useAudioGuide() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState<AudioSpeed>(1.0);
    const [currentText, setCurrentText] = useState('');
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const estimatedDurationRef = useRef<number>(0);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, []);

    const clearProgress = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    const startProgressTracking = useCallback((textLength: number, rate: number) => {
        clearProgress();
        // Estimate ~150 words per minute at rate 1.0, average word length ~5 chars
        const wordsPerMinute = 150 * rate;
        const words = textLength / 5;
        const durationMs = (words / wordsPerMinute) * 60 * 1000;
        estimatedDurationRef.current = durationMs;
        startTimeRef.current = Date.now();

        progressIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const pct = Math.min((elapsed / durationMs) * 100, 99);
            setProgress(pct);
        }, 200);
    }, [clearProgress]);

    const stopAudio = useCallback(() => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        setCurrentText('');
        clearProgress();
    }, [clearProgress]);

    const pauseAudio = useCallback(() => {
        if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            setIsPaused(true);
            clearProgress();
        }
    }, [clearProgress]);

    const resumeAudio = useCallback(() => {
        if ('speechSynthesis' in window && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
            // Resume progress from current point
            const remaining = estimatedDurationRef.current * ((100 - progress) / 100);
            startTimeRef.current = Date.now() - (estimatedDurationRef.current - remaining);
            progressIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current;
                const pct = Math.min((elapsed / estimatedDurationRef.current) * 100, 99);
                setProgress(pct);
            }, 200);
        }
    }, [progress]);

    const buildNarrationText = useCallback((result: AnalysisResult, lang: Language): string => {
        const parts: string[] = [];
        const isTr = lang === 'tr';

        // Title
        parts.push(result.title + '.');

        // Dating
        if (result.dating?.period) {
            parts.push((isTr ? 'Dönem: ' : 'Period: ') + result.dating.period + '.');
        }
        if (result.dating?.date_range) {
            parts.push((isTr ? 'Tarih aralığı: ' : 'Date range: ') + result.dating.date_range + '.');
        }

        // Origin
        if (result.origin?.region) {
            parts.push((isTr ? 'Bölge: ' : 'Region: ') + result.origin.region + '.');
        }

        // Description
        if (result.analysis?.description) {
            parts.push(result.analysis.description);
        }

        // Historical context
        if (result.historical_context) {
            parts.push((isTr ? 'Tarihsel bağlam. ' : 'Historical context. ') + result.historical_context);
        }

        // Cultural significance
        if (result.cultural_significance) {
            parts.push((isTr ? 'Kültürel önem. ' : 'Cultural significance. ') + result.cultural_significance);
        }

        // Symbolism
        if (result.symbolism) {
            parts.push((isTr ? 'Sembolizm. ' : 'Symbolism. ') + result.symbolism);
        }

        // Material & Technique
        if (result.specs?.material) {
            parts.push((isTr ? 'Malzeme: ' : 'Material: ') + result.specs.material + '.');
        }
        if (result.specs?.technique) {
            parts.push((isTr ? 'Teknik: ' : 'Technique: ') + result.specs.technique + '.');
        }

        // Inscription
        if (result.analysis?.inscription?.original) {
            parts.push((isTr ? 'Yazıt: ' : 'Inscription: ') + result.analysis.inscription.original + '.');
            if (result.analysis.inscription.translation) {
                parts.push((isTr ? 'Çeviri: ' : 'Translation: ') + result.analysis.inscription.translation + '.');
            }
        }

        // Fun fact
        if (result.fun_fact) {
            parts.push((isTr ? 'İlginç bilgi: ' : 'Fun fact: ') + result.fun_fact);
        }

        // Curator note
        if (result.curator_note) {
            parts.push((isTr ? 'Küratör notu: ' : "Curator's note: ") + result.curator_note);
        }

        return parts.filter(Boolean).join(' ');
    }, []);

    const playAudio = useCallback((result: AnalysisResult, lang: Language) => {
        if (!('speechSynthesis' in window)) {
            useAppStore.getState().addLog('error', lang === 'tr'
                ? 'Tarayıcınız sesli okuma özelliğini desteklemiyor.'
                : 'Your browser does not support text-to-speech.');
            return;
        }

        // Stop any current reading
        window.speechSynthesis.cancel();
        clearProgress();

        const textToRead = buildNarrationText(result, lang);
        if (!textToRead) return;

        setCurrentText(textToRead);

        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
        utterance.rate = speed;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            setIsPlaying(true);
            setIsPaused(false);
            startProgressTracking(textToRead.length, speed);
        };
        utterance.onend = () => {
            setIsPlaying(false);
            setIsPaused(false);
            setProgress(100);
            clearProgress();
            setTimeout(() => setProgress(0), 1500);
        };
        utterance.onerror = () => {
            setIsPlaying(false);
            setIsPaused(false);
            setProgress(0);
            clearProgress();
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [speed, buildNarrationText, clearProgress, startProgressTracking]);

    const toggleAudio = useCallback((result: AnalysisResult, lang: Language) => {
        if (isPlaying && !isPaused) {
            pauseAudio();
        } else if (isPaused) {
            resumeAudio();
        } else {
            playAudio(result, lang);
        }
    }, [isPlaying, isPaused, playAudio, pauseAudio, resumeAudio]);

    const changeSpeed = useCallback((newSpeed: AudioSpeed) => {
        setSpeed(newSpeed);
    }, []);

    return {
        isPlaying,
        isPaused,
        progress,
        speed,
        currentText,
        toggleAudio,
        stopAudio,
        pauseAudio,
        resumeAudio,
        changeSpeed,
    };
}
