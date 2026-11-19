import React from 'react';
import { Volume2, Pause, Play, Square, Gauge } from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { t } from '../i18n';
import { useAudioGuide, AudioSpeed } from '../hooks/useAudioGuide';

interface AudioGuideCardProps {
    result: AnalysisResult;
    lang: Language;
}

const SPEEDS: AudioSpeed[] = [0.7, 0.85, 1.0, 1.2, 1.5];

export const AudioGuideCard: React.FC<AudioGuideCardProps> = ({ result, lang }) => {
    const {
        isPlaying,
        isPaused,
        progress,
        speed,
        toggleAudio,
        stopAudio,
        changeSpeed,
    } = useAudioGuide();

    const getStatusText = () => {
        if (isPlaying && !isPaused) return t('audio.playing', lang);
        if (isPaused) return t('audio.paused', lang);
        return t('audio.subtitle', lang);
    };

    const getButtonLabel = () => {
        if (isPlaying && !isPaused) return t('audio.pause', lang);
        if (isPaused) return t('audio.resume', lang);
        return t('audio.play', lang);
    };

    const getButtonIcon = () => {
        if (isPlaying && !isPaused) return <Pause size={16} />;
        if (isPaused) return <Play size={16} />;
        return <Volume2 size={16} />;
    };

    return (
        <div className="audio-guide-card">
            {/* Progress bar */}
            {(isPlaying || isPaused) && (
                <div className="audio-guide-progress-track">
                    <div
                        className="audio-guide-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="audio-guide-content">
                <div className="audio-guide-info">
                    <div className={`audio-guide-icon ${isPlaying && !isPaused ? 'active' : ''}`}>
                        <Volume2 size={20} />
                    </div>
                    <div>
                        <h3 className="audio-guide-title">
                            {t('audio.title', lang)}
                        </h3>
                        <p className="audio-guide-subtitle">
                            {getStatusText()}
                        </p>
                    </div>
                </div>

                <div className="audio-guide-controls">
                    {/* Speed selector – only show when playing or paused */}
                    {(isPlaying || isPaused) && (
                        <div className="audio-guide-speed">
                            <Gauge size={12} className="audio-guide-speed-icon" />
                            {SPEEDS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => changeSpeed(s)}
                                    className={`audio-guide-speed-btn ${speed === s ? 'active' : ''}`}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="audio-guide-actions">
                        <button
                            onClick={() => toggleAudio(result, lang)}
                            className={`audio-guide-btn ${isPlaying && !isPaused ? 'playing' : ''}`}
                        >
                            {getButtonIcon()}
                            {getButtonLabel()}
                        </button>

                        {(isPlaying || isPaused) && (
                            <button
                                onClick={stopAudio}
                                className="audio-guide-btn stop"
                            >
                                <Square size={14} />
                                {t('audio.stop', lang)}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
