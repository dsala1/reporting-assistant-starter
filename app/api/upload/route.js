// app/api/upload/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx'; // <- IMPORT CORRECTO (no default)

// Utils: CSV -> estructura -> Markdown
function parseCsv(text) {
  const lines = (text || '').split(/\r?\n/).filter(l => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(l => l.split(','));
  return { header, rows };
}

function toMarkdownTable(header, rows) {
  if (!header.length) return '';
  const head = `| ${header.join(' | ')} |`;
  const sep  = `| ${header.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => String(c ?? '')).join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const files = form.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ ok: false, error: 'Sin archivos' }, { status: 400 });
    }

    const previews = [];

    for (const file of files) {
      if (!file) continue;
      const name = file.name || 'archivo';
      const lower = name.toLowerCase();

      // Leemos bytes del file
      const buf = Buffer.from(await file.arrayBuffer());

      let csvText = '';
      if (lower.endsWith('.csv')) {
        csvText = buf.toString('utf8');
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        // Parse seguro con xlsx
        const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(ws);
      } else {
        previews.push(`### ${name}\n_Archivo no soportado (usa .csv / .xlsx / .xls)_`);
        continue;
      }

      const { header, rows } = parseCsv(csvText);
      const sample = rows.slice(0, 50);
      const md = toMarkdownTable(header, sample);
      previews.push(`### ${name}\n${md || '_vacío_'}\n`);
    }

    return NextResponse.json({ ok: true, previewsMarkdown: previews });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
