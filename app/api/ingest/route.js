// app/api/ingest/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

function workbookToCsv(wb) {
  const sheet = wb.SheetNames[0];
  const ws = wb.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const header = (rows[0] || []).map(v => String(v ?? ''));
  const csv = XLSX.utils.sheet_to_csv(ws);
  return {
    sheet,
    columns: header,
    rowsCount: Math.max((rows.length || 0) - 1, 0),
    csv
  };
}

export async function POST(req) {
  try {
    const { file_id, workspace_id, storage_path, filename } = await req.json();
    if (!file_id || !workspace_id || !storage_path || !filename) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const supa = createClient(url, serviceKey);

    // 1) URL firmada para descargar el fichero original (bucket uploads)
    const { data: signed, error: signErr } = await supa
      .storage.from('uploads')
      .createSignedUrl(storage_path, 300);
    if (signErr) throw signErr;

    const res = await fetch(signed.signedUrl);
    if (!res.ok) throw new Error('Fetch original failed');
    const buf = await res.arrayBuffer();

    // 2) Convertir a CSV normalizado
    let csv, columns, rowsCount, sheet;
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv')) {
      const text = Buffer.from(buf).toString('utf8');
      csv = text;
      const lines = text.split(/\r?\n/);
      columns = (lines[0] || '').split(',').map(s => s.trim());
      rowsCount = Math.max(lines.filter(Boolean).length - 1, 0);
      sheet = 'csv';
    } else {
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const out = workbookToCsv(wb);
      csv = out.csv;
      columns = out.columns;
      rowsCount = out.rowsCount;
      sheet = out.sheet;
    }

    // 3) Subir CSV al bucket 'datasets'
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.(xlsx|xls|csv)$/i, '.csv');
    const outPath = `ws/${workspace_id}/${ts}-${safe}`;

    const csvBytes = new TextEncoder().encode(csv); // ArrayBuffer/Uint8Array sirve para upload
    const { error: upErr } = await supa
      .storage.from('datasets')
      .upload(outPath, csvBytes, { contentType: 'text/csv', upsert: false });
    if (upErr) throw upErr;

    // 4) Registrar en tabla datasets
    const { error: insErr } = await supa.from('datasets').insert({
      workspace_id,
      file_id,
      filename,
      storage_path: outPath,
      columns,
      rows_count: rowsCount
    });
    if (insErr) throw insErr;

    // 5) Marcar file como 'ingested'
    await supa.from('files').update({ status: 'ingested' }).eq('id', file_id);

    return NextResponse.json({ ok: true, sheet, columns, rowsCount, outPath });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
