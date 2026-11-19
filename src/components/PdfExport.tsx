import { escapeHtml, safeImageSource } from '../lib/safeHtml';
import React from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { t } from '../i18n';
import { useAppStore } from '../store/useAppStore';

interface PdfExportProps {
    result: AnalysisResult;
    imageDataUrl: string | null;
    lang: Language;
}

export const PdfExport: React.FC<PdfExportProps> = ({ result, imageDataUrl, lang }) => {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const generatePdf = async () => {
        setIsGenerating(true);
        try {
            // Create a printable HTML document
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(result.title)} — ArcheLens Open Source ${lang === 'tr' ? 'Analiz Raporu' : 'Analysis Report'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1c1917; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 2px solid #e7e5e4; }
    .header h1 { font-family: 'Playfair Display', serif; font-size: 32px; margin-bottom: 10px; }
    .header .meta { font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 3px; }
    .header .confidence { display: inline-block; padding: 6px 16px; background: #1c1917; color: white; border-radius: 20px; font-size: 11px; font-weight: bold; margin-top: 15px; }
    
    .image-container { text-align: center; margin: 30px 0; }
    .image-container img { max-width: 100%; max-height: 400px; border-radius: 16px; border: 1px solid #e7e5e4; }
    
    .section { margin-bottom: 30px; }
    .section h2 { font-family: 'Playfair Display', serif; font-size: 18px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #e7e5e4; color: #1c1917; }
    .section p { color: #44403c; font-size: 14px; line-height: 1.8; }
    
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .grid-item { padding: 15px; background: #fafaf9; border-radius: 12px; border: 1px solid #e7e5e4; }
    .grid-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #a8a29e; font-weight: 600; margin-bottom: 4px; }
    .grid-item .value { font-size: 14px; font-weight: 500; color: #1c1917; }
    
    .fun-fact { padding: 20px; background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a; margin: 25px 0; }
    .fun-fact .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #b45309; font-weight: 700; margin-bottom: 5px; }
    .fun-fact p { font-style: italic; color: #78350f; font-size: 14px; }
    
    .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e7e5e4; font-size: 10px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; }

    @media print {
      body { padding: 20px; }
      .header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="meta">ARCHE LENS OPEN SOURCE • ${lang === 'tr' ? 'ANALİZ RAPORU' : 'ANALYSIS REPORT'}</div>
    <h1>${escapeHtml(result.title)}</h1>
    <div class="meta">${escapeHtml(result.origin?.region || '')} • ${escapeHtml(result.origin?.culture || '')} • ${escapeHtml(result.dating?.period || '')}</div>
    <div class="confidence">${lang === 'tr' ? 'GÜVEN SKORU' : 'CONFIDENCE SCORE'}: %${escapeHtml(result.confidence_score)}</div>
  </div>

  ${imageDataUrl ? `<div class="image-container"><img src="${escapeHtml(safeImageSource(imageDataUrl))}" alt="${escapeHtml(result.title)}" /></div>` : ''}

  <div class="section">
    <h2>${lang === 'tr' ? 'Eser Analizi' : 'Artifact Analysis'}</h2>
    <p>${escapeHtml(result.analysis?.description || '')}</p>
  </div>

  <div class="section">
    <h2>${lang === 'tr' ? 'Tarihsel Bilgiler' : 'Historical Information'}</h2>
    <div class="grid">
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Dönem' : 'Period'}</div>
        <div class="value">${escapeHtml(result.dating?.period || '')}</div>
      </div>
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Tarih Aralığı' : 'Date Range'}</div>
        <div class="value">${escapeHtml(result.dating?.date_range || '')}</div>
      </div>
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Yüzyıl' : 'Century'}</div>
        <div class="value">${escapeHtml(result.dating?.century || '')}</div>
      </div>
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Bölge' : 'Region'}</div>
        <div class="value">${escapeHtml(result.origin?.region || '')}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>${lang === 'tr' ? 'Teknik Özellikler' : 'Technical Specifications'}</h2>
    <div class="grid">
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Malzeme' : 'Material'}</div>
        <div class="value">${escapeHtml(result.specs?.material || '')}</div>
      </div>
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Teknik' : 'Technique'}</div>
        <div class="value">${escapeHtml(result.specs?.technique || '')}</div>
      </div>
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Üslup' : 'Style'}</div>
        <div class="value">${escapeHtml(result.specs?.style || '')}</div>
      </div>
      <div class="grid-item">
        <div class="label">${lang === 'tr' ? 'Boyut' : 'Dimensions'}</div>
        <div class="value">${escapeHtml(result.specs?.dimensions || '')}</div>
      </div>
    </div>
  </div>

  ${result.analysis?.iconography ? `
  <div class="section">
    <h2>${lang === 'tr' ? 'İkonografi & Sembolizm' : 'Iconography & Symbolism'}</h2>
    <p>${escapeHtml(result.analysis.iconography)}</p>
  </div>
  ` : ''}

  <div class="section">
    <h2>${lang === 'tr' ? 'Kondisyon Raporu' : 'Condition Report'}</h2>
    <p><strong>${lang === 'tr' ? 'Kondisyon' : 'Condition'}:</strong> ${escapeHtml(result.preservation?.condition || '')}</p>
    <p><strong>${lang === 'tr' ? 'Hasarlar' : 'Damages'}:</strong> ${escapeHtml(result.preservation?.damages || '')}</p>
  </div>

  ${result.fun_fact ? `
  <div class="fun-fact">
    <div class="label">${lang === 'tr' ? 'Biliyor muydunuz?' : 'Did You Know?'}</div>
    <p>"${escapeHtml(result.fun_fact)}"</p>
  </div>
  ` : ''}

  ${result.curator_note ? `
  <div class="section">
    <h2>${lang === 'tr' ? 'Küratörün Notu' : "Curator's Note"}</h2>
    <p><em>"${escapeHtml(result.curator_note)}"</em></p>
  </div>
  ` : ''}

  <div class="footer">
    ArcheLens Open Source • ${new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
</body>
</html>`;

            // Open print dialog
            const printWindow = window.open('', '_blank');
            if (printWindow) printWindow.opener = null;
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                // Wait for images to load
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            useAppStore.getState().addLog('error', '[PDF] Generation failed', { error: errorMessage });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <button
            onClick={generatePdf}
            disabled={isGenerating}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors py-2 disabled:opacity-50"
        >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {isGenerating ? t('pdf.generating', lang) : t('pdf.download', lang)}
        </button>
    );
};
