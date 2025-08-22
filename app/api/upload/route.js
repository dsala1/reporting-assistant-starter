// app/api/upload/route.js
export const runtime = 'nodejs';

import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';

// Convierte una hoja (array de objetos) a tabla Markdown (con GFM)
function aoaToMarkdown(headers, rows, maxRows = 40) {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.slice(0, maxRows).map(r => `| ${r.map(v => (v ?? '')).join(' | ')} |`).join('\n');
  return `${head}\n${body}`;
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('files'); // puede venir n archivos
    if (!files || files.length === 0) {
      return NextResponse.json({ ok: false, error: 'No files' }, { status: 400 });
    }

    const previewsMarkdown = [];

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: 'buffer' });

      const sheets = wb.SheetNames.slice(0, 3); // limita a 3 hojas por archivo (ajustable)
      for (const sName of sheets) {
        const ws = wb.Sheets[sName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }); // array-of-arrays
        if (!json || json.length === 0) continue;

        const headers = (json[0] || []).map(h => String(h ?? ''));
        const rows = json.slice(1).map(r => r.map(c => (c ?? '')));
        const md = aoaToMarkdown(headers, rows);

        previewsMarkdown.push(`### ${file.name} — ${sName}\n\n${md}`);
      }
    }

    return NextResponse.json({ ok: true, previewsMarkdown });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
