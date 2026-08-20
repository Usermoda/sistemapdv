import * as XLSX from 'xlsx';

export type Column = {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'date' | 'text';
};

export function fmtCurrency(v: unknown): string {
  const n = Number(v ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtNumber(v: unknown): string {
  const n = Number(v ?? 0);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
}

export function formatCell(row: Record<string, unknown>, col: Column): string {
  const v = row[col.key];
  if (col.format === 'currency') return fmtCurrency(v);
  if (col.format === 'number') return fmtNumber(v);
  if (col.format === 'date') return fmtDate(v);
  return v == null ? '' : String(v);
}

export function exportXLSX(filename: string, sheetName: string, columns: Column[], rows: Record<string, unknown>[]): void {
  const data = [
    columns.map((c) => c.header),
    ...rows.map((r) =>
      columns.map((c) => {
        const v = r[c.key];
        if (c.format === 'currency' || c.format === 'number') return Number(v ?? 0);
        if (c.format === 'date' && v) return new Date(String(v));
        return v ?? '';
      })
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = columns.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function printReport(title: string, subtitle: string, columns: Column[], rows: Record<string, unknown>[], summary?: Array<{ label: string; value: string }>): void {
  const w = window.open('', '_blank', 'width=1000,height=800');
  if (!w) return;
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>${columns
          .map((c) => `<td class="${c.align ?? 'left'}">${escapeHtml(formatCell(r, c))}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const summaryHtml = summary
    ? `<div class="summary">${summary
        .map((s) => `<div><span class="lbl">${escapeHtml(s.label)}</span><span class="val">${escapeHtml(s.value)}</span></div>`)
        .join('')}</div>`
    : '';
  w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  td.right, th.right { text-align: right; }
  td.center, th.center { text-align: center; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 16px 0; }
  .summary > div { padding: 10px; background: #f9fafb; border-radius: 6px; }
  .summary .lbl { display: block; font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
  .summary .val { display: block; font-size: 16px; font-weight: 700; margin-top: 4px; }
  .footer { margin-top: 20px; text-align: right; font-size: 10px; color: #888; }
  @media print {
    body { margin: 12mm; }
    button { display: none !important; }
  }
  button { position: fixed; top: 12px; right: 12px; padding: 8px 16px; background: #2563eb; color: white; border: 0; border-radius: 6px; cursor: pointer; font-weight: 600; }
</style></head>
<body>
  <button onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">${escapeHtml(subtitle)}</div>
  ${summaryHtml}
  <table>
    <thead><tr>${columns.map((c) => `<th class="${c.align ?? 'left'}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
