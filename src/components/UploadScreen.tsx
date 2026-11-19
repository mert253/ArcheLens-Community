import React from 'react';
import { Upload, Camera, Link as LinkIcon, Images, X, Brain, Globe2, Scan, Wand2, Map } from 'lucide-react';
import { Language } from '../types';
import { t } from '../i18n';

interface UploadScreenProps {
    fileInputRef: React.RefObject<HTMLInputElement>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMultiFileChange: (files: File[]) => void;
    onCompareChange?: (files: File[]) => void;
    onUrlAnalyze: (url: string) => void;
    lang: Language;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
    fileInputRef, onFileChange, onMultiFileChange, onCompareChange, onUrlAnalyze, lang
}) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [urlInput, setUrlInput] = React.useState('');
    const [showUrl, setShowUrl] = React.useState(false);
    const [uploadMode, setUploadMode] = React.useState<'single' | 'multi' | 'detective'>('single');
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [previews, setPreviews] = React.useState<string[]>([]);
    const multiInputRef = React.useRef<HTMLInputElement>(null);

    const isTr = lang === 'tr';

    React.useEffect(() => {
        return () => { previews.forEach(u => URL.revokeObjectURL(u)); };
    }, [previews]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files) as File[];
        const images = dropped.filter((f: File) => f.type.startsWith('image/'));
        if (uploadMode !== 'single' && images.length > 0) {
            addMultiFiles(images);
        } else if (images[0]) {
            const dt = new DataTransfer();
            dt.items.add(images[0]);
            if (fileInputRef.current) {
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };

    const addMultiFiles = (newFiles: File[]) => {
        const max = uploadMode === 'detective' ? 2 : 5;
        const combined = [...selectedFiles, ...newFiles].slice(0, max);
        setSelectedFiles(combined);
        previews.forEach(u => URL.revokeObjectURL(u));
        setPreviews(combined.map(f => URL.createObjectURL(f)));
    };

    const removeFile = (idx: number) => {
        const updated = selectedFiles.filter((_, i) => i !== idx);
        setSelectedFiles(updated);
        previews.forEach(u => URL.revokeObjectURL(u));
        setPreviews(updated.map(f => URL.createObjectURL(f)));
    };

    const handleMultiUpload = () => {
        if (uploadMode === 'detective' && selectedFiles.length === 2 && onCompareChange) {
            onCompareChange(selectedFiles);
        } else if (uploadMode === 'multi' && selectedFiles.length > 0) {
            onMultiFileChange(selectedFiles);
        }
    };

    const handleCamera = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file && fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        input.click();
    };

    const features = [
        { icon: <Scan size={13} />, label: isTr ? 'AI Analiz' : 'AI Analysis' },
        { icon: <Wand2 size={13} />, label: isTr ? 'Restorasyon' : 'Restoration' },
        { icon: <Map size={13} />, label: isTr ? 'Harita' : 'Map View' },
        { icon: <Globe2 size={13} />, label: isTr ? 'Keşfet' : 'Discover' },
    ];

    return (
        <div className="upload-page animate-fade-in-up">
            {/* Ambient glow orbs */}
            <div className="upload-ambient upload-ambient-1" />
            <div className="upload-ambient upload-ambient-2" />

            <div className="upload-container">
                {/* Badge */}
                <div className="upload-badge">
                    <span className="upload-badge-dot" />
                    {t('upload.aiEngine', lang)}
                </div>

                {/* Title */}
                <h1 className="upload-title">
                    {t('upload.heading', lang)}
                    <em className="upload-title-accent">{t('upload.headingHighlight', lang)}</em>
                </h1>

                <p className="upload-subtitle">
                    {t('upload.subtitle', lang)}
                </p>

                {/* Mode selector */}
                <div className="upload-mode-tabs" role="group" aria-label={isTr ? 'Yükleme modu' : 'Upload mode'}>
                    {([
                        { key: 'single', icon: <Upload size={12} />, label: isTr ? 'Tekli Yükleme' : 'Single Upload' },
                        { key: 'multi',  icon: <Images size={12} />, label: isTr ? 'Çoklu Yükleme' : 'Multi Upload' },
                        { key: 'detective', icon: <Brain size={12} />, label: isTr ? 'Detektif Modu' : 'Detective Mode' },
                    ] as const).map(m => (
                        <button
                            key={m.key}
                            aria-pressed={uploadMode === m.key}
                            onClick={() => { setUploadMode(m.key); setSelectedFiles([]); setPreviews([]); }}
                            className={`mode-tab${uploadMode === m.key ? ' active' : ''}`}
                        >
                            {m.icon} {m.label}
                        </button>
                    ))}
                </div>

                {/* ── Single upload zone ── */}
                {uploadMode === 'single' && (
                    <div
                        className={`upload-dropzone${isDragging ? ' is-dragging' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        role="button"
                        tabIndex={0}
                        aria-label={isTr ? 'Görsel yüklemek için tıklayın veya sürükleyin' : 'Click or drag to upload image'}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }}
                    >
                        <div className="upload-icon-wrap">
                            <Upload size={28} strokeWidth={1.5} />
                        </div>
                        <p className="upload-dropzone-text">
                            {isDragging
                                ? (isTr ? 'Bırakın!' : 'Drop it!')
                                : t('upload.button', lang)}
                        </p>
                        <p className="upload-dropzone-hint">{t('upload.formats', lang)}</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onClick={(e) => e.stopPropagation()}
                            onChange={onFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>
                )}

                {/* ── Multi / Detective upload zone ── */}
                {uploadMode !== 'single' && (
                    <div style={{ width: '100%' }}>
                        <div
                            className={`multi-dropzone${isDragging ? ' is-dragging' : ''}`}
                            onClick={() => multiInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            role="button"
                            tabIndex={0}
                            aria-label={isTr ? 'Birden fazla görsel yükleyin' : 'Upload multiple images'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    multiInputRef.current?.click();
                                }
                            }}
                        >
                            <div className="upload-icon-wrap">
                                <Images size={26} strokeWidth={1.5} />
                            </div>
                            <p className="upload-dropzone-text" style={{ fontSize: '1.15rem' }}>
                                {uploadMode === 'detective'
                                    ? (isTr ? 'Karşılaştırmak için 2 görsel seçin' : 'Select 2 images to compare')
                                    : (isTr ? 'Birden Fazla Görsel Ekleyin' : 'Add multiple images')}
                            </p>
                            <p className="upload-dropzone-hint">
                                {uploadMode === 'detective'
                                    ? (isTr ? 'Max 2 görsel' : 'Max 2 images')
                                    : (isTr ? 'Aynı eserin farklı açıları • Max 5' : 'Different angles • Max 5')}
                            </p>
                            <input
                                type="file"
                                ref={multiInputRef}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { if (e.target.files) addMultiFiles(Array.from(e.target.files)); }}
                                accept="image/*"
                                multiple
                                className="hidden"
                            />
                        </div>

                        {previews.length > 0 && (
                            <div className="animate-fade-in-up" style={{ marginTop: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.25rem' }}>
                                    {previews.map((url, idx) => (
                                        <div key={idx} className="preview-thumb" style={{ width: 96, height: 96 }}>
                                            <img src={url} alt={`Image ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                className="preview-remove"
                                                aria-label={isTr ? 'Görseli kaldır' : 'Remove image'}
                                                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                            >
                                                <X size={12} strokeWidth={2.5} />
                                            </button>
                                            <span style={{
                                                position: 'absolute', bottom: 6, left: 6,
                                                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                                                fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6
                                            }}>{idx + 1}</span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        onClick={handleMultiUpload}
                                        disabled={uploadMode === 'detective' && selectedFiles.length !== 2}
                                        style={{
                                            padding: '12px 40px',
                                            borderRadius: 100,
                                            border: 'none',
                                            background: (uploadMode === 'detective' && selectedFiles.length !== 2)
                                                ? 'var(--bg-tertiary)' : 'var(--accent)',
                                            color: (uploadMode === 'detective' && selectedFiles.length !== 2)
                                                ? 'var(--text-tertiary)' : 'var(--accent-text)',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase',
                                            cursor: (uploadMode === 'detective' && selectedFiles.length !== 2) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {uploadMode === 'detective'
                                            ? (isTr ? `Karşılaştır (${selectedFiles.length}/2)` : `Compare (${selectedFiles.length}/2)`)
                                            : (isTr ? `${selectedFiles.length} Görseli Analiz Et` : `Analyze ${selectedFiles.length} Images`)}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Secondary actions */}
                <div className="upload-actions">
                    <button onClick={handleCamera} className="upload-action-btn" aria-label={t('upload.camera', lang)}>
                        <Camera size={13} style={{ color: 'var(--accent)' }} />
                        {t('upload.camera', lang)}
                    </button>
                    <button
                        onClick={() => setShowUrl(!showUrl)}
                        aria-expanded={showUrl}
                        className="upload-action-btn"
                    >
                        <LinkIcon size={13} style={{ color: 'var(--accent)' }} />
                        {t('upload.orUrl', lang)}
                    </button>
                </div>

                {/* URL input */}
                {showUrl && (
                    <div className="upload-url-bar animate-fade-in-up" style={{ width: '100%' }}>
                        <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder={t('upload.urlPlaceholder', lang)}
                            className="upload-url-input"
                            onKeyDown={(e) => { if (e.key === 'Enter' && urlInput.trim()) onUrlAnalyze(urlInput.trim()); }}
                        />
                        <button
                            onClick={() => urlInput.trim() && onUrlAnalyze(urlInput.trim())}
                            disabled={!urlInput.trim()}
                            className="upload-url-submit"
                        >
                            {t('upload.urlAnalyze', lang)} <Globe2 size={11} />
                        </button>
                    </div>
                )}

                {/* Feature strip */}
                <div className="upload-features">
                    {features.map((f, i) => (
                        <span key={i} className="upload-feature">
                            {f.icon} {f.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
