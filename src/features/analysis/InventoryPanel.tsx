import { csvTextCell } from '../../lib/csv';
import React from 'react';
import { ClipboardList, Download, FileText } from 'lucide-react';
import { AnalysisResult, InventoryData } from '../../types';

interface InventoryPanelProps {
  result: AnalysisResult;
  lang: 'tr' | 'en';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-[var(--border-primary)] last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] w-40 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs text-[var(--text-primary)] leading-relaxed">{value || '—'}</span>
    </div>
  );
}

function buildCatalogId(inv: InventoryData, result: AnalysisResult): string {
  return inv.catalog_id_suggestion || `ARC-${result.dating?.century?.replace(/\D/g, '') || 'XX'}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ result, lang }) => {
  const inv = result.inventory;
  const tr = lang === 'tr';

  if (!inv) {
    return (
      <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
        {tr ? 'Envanter verisi mevcut değil.' : 'No inventory data available.'}
      </div>
    );
  }

  const catalogId = buildCatalogId(inv, result);

  const rows = tr ? [
    { label: 'Katalog No', value: catalogId },
    { label: 'Tür', value: inv.type },
    { label: 'Dönem', value: inv.period },
    { label: 'Malzeme', value: inv.material },
    { label: 'Durum', value: inv.condition },
    { label: 'Tahmini Ölçü', value: inv.dimensions_estimate },
    { label: 'Köken / Kültür', value: `${result.origin?.culture || ''} · ${result.origin?.region || ''}` },
    { label: 'Koruma Tavsiyesi', value: inv.preservation_recommendation },
  ] : [
    { label: 'Catalog ID', value: catalogId },
    { label: 'Type', value: inv.type },
    { label: 'Period', value: inv.period },
    { label: 'Material', value: inv.material },
    { label: 'Condition', value: inv.condition },
    { label: 'Est. Dimensions', value: inv.dimensions_estimate },
    { label: 'Origin / Culture', value: `${result.origin?.culture || ''} · ${result.origin?.region || ''}` },
    { label: 'Conservation Rec.', value: inv.preservation_recommendation },
  ];

  // ── CSV export ──
  const exportCSV = () => {
    const header = tr
      ? ['Katalog No', 'Başlık', 'Tür', 'Dönem', 'Malzeme', 'Durum', 'Tahmini Ölçü', 'Kültür', 'Bölge', 'Koruma Tavsiyesi']
      : ['Catalog ID', 'Title', 'Type', 'Period', 'Material', 'Condition', 'Est. Dimensions', 'Culture', 'Region', 'Preservation Rec.'];
    const values = [
      catalogId, result.title, inv.type, inv.period, inv.material, inv.condition,
      inv.dimensions_estimate, result.origin?.culture || '', result.origin?.region || '',
      inv.preservation_recommendation
    ].map(csvTextCell);

    const csv = [header.join(','), values.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `envanter_${catalogId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF export ──
  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ArcheLens Open Source', 14, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(tr ? 'Müze Envanter Fişi' : 'Museum Inventory Record', 14, 28);

    // Title + catalog
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(result.title || (tr ? 'Bilinmeyen Eser' : 'Unknown Artifact'), 14, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${tr ? 'Katalog No' : 'Catalog ID'}: ${catalogId}`, 14, 49);
    doc.text(`${tr ? 'Oluşturma tarihi' : 'Generated'}: ${new Date().toLocaleDateString()}`, 14, 54);
    doc.setTextColor(0);

    // Separator
    doc.setDrawColor(200);
    doc.line(14, 58, 196, 58);

    // Fields
    let y = 66;
    const fieldData = tr ? [
      ['Tür', inv.type], ['Dönem', inv.period], ['Malzeme', inv.material],
      ['Durum', inv.condition], ['Tahmini Ölçü', inv.dimensions_estimate],
      ['Kültür', result.origin?.culture || ''], ['Bölge', result.origin?.region || ''],
    ] : [
      ['Type', inv.type], ['Period', inv.period], ['Material', inv.material],
      ['Condition', inv.condition], ['Est. Dimensions', inv.dimensions_estimate],
      ['Culture', result.origin?.culture || ''], ['Region', result.origin?.region || ''],
    ];

    for (const [label, value] of fieldData) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label + ':', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '—', 55, y);
      y += 7;
    }

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(tr ? 'Koruma Tavsiyesi:' : 'Conservation Rec.:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(inv.preservation_recommendation || '—', 176);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 6;

    // Description
    doc.setFont('helvetica', 'bold');
    doc.text(tr ? 'Açıklama:' : 'Description:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(result.analysis?.description || '—', 176);
    doc.text(descLines.slice(0, 8), 14, y); // cap at 8 lines

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by ArcheLens Open Source — AI Archaeological Analysis Platform', 14, 285);

    doc.save(`envanter_${catalogId}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
            {tr ? 'Envanter Fişi' : 'Inventory Record'}
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider
              text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border
              border-[var(--border-primary)] hover:border-[var(--accent)] rounded-xl px-3 py-1.5"
          >
            <FileText className="w-3 h-3" /> CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider
              text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border
              border-[var(--border-primary)] hover:border-[var(--accent)] rounded-xl px-3 py-1.5"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
        </div>
      </div>

      {/* Field table */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl px-5 py-1">
        {rows.map(({ label, value }) => (
          <Row key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
};
