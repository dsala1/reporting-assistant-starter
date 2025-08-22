// app/api/chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'uploads';

// Supabase admin (por si en el futuro quieres volver a datasets)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const admin = createClient(url, service, { auth: { persistSession: false } });

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ----------------- utils CSV→Markdown (para fallback de datasets) -------------
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(l => l.split(','));
  return { header, rows };
}
function sampleRows(rows, n = 40) {
  return rows.slice(0, Math.max(1, Math.min(n, rows.length)));
}
function toMarkdownTable(header, rows) {
  if (!header.length) return '';
  const head = `| ${header.join(' | ')} |`;
  const sep = `| ${header.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => String(c ?? '')).join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}
// -----------------------------------------------------------------------------

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      fileIds = [],
      prompt = '',
      messages = [],
      previewsMarkdown = [], // ← clave nueva: previews que vienen de /api/upload
    } = body || {};

    let previews = [];

    if (Array.isArray(previewsMarkdown) && previewsMarkdown.length > 0) {
      // Camino NUEVO: archivos subidos desde el chat (sin datasets)
      previews = previewsMarkdown;
    } else if (workspaceId && fileIds.length > 0) {
      // Camino antiguo (datasets listos en Supabase, por si lo quieres conservar)
      const { data: ds, error: dsErr } = await admin
        .from('datasets')
        .select('id,name,csv_path,ready')
        .eq('workspace_id', workspaceId)
        .in('id', fileIds)
        .eq('ready', true);

      if (dsErr) {
        return NextResponse.json({ error: `Error datasets: ${dsErr.message}` }, { status: 500 });
      }

      if (!ds || ds.length === 0) {
        return NextResponse.json({ error: 'No hay datasets listos para analizar.' }, { status: 200 });
      }

      for (const d of ds) {
        if (!d.csv_path) continue;
        const { data: file, error: dlErr } = await admin.storage
          .from(FILES_BUCKET)
          .download(d.csv_path);
        if (dlErr) {
          previews.push(`- ${d.name || d.id}: no se pudo descargar (${dlErr.message})`);
          continue;
        }
        const text = await file.text();
        const { header, rows } = parseCsv(text);
        const sample = sampleRows(rows, 20);
        const md = toMarkdownTable(header, sample);
        previews.push(`### ${d.name || d.id}\n${md || '_vacío_'}\n`);
      }
    } else {
      // Sin previews ni datasets → responde educadamente
      return NextResponse.json(
        { ok: true, answer: 'No adjuntaste archivos ni elegiste datasets. Sube 1..N CSV/XLSX o indícame qué usar.' },
        { status: 200 }
      );
    }

    const system = [
      'Eres un analista senior de datos.',
      'Recibirás previews (muestras) de datasets en tablas Markdown.',
      'Responde en español con insights claros y accionables.',
      'Si procede, muestra tablas Markdown y sugiere agregaciones/segmentaciones.',
    ].join(' ');

    const userContent = [
      '## Datasets (muestras)',
      previews.join('\n\n'),
      '',
      '## Petición del usuario',
      prompt || '(sin prompt adicional)',
    ].join('\n');

    const chat = [
      { role: 'system', content: system },
      ...(Array.isArray(messages) ? messages : []),
      { role: 'user', content: userContent },
    ];

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: chat,
      temperature: 0.3,
    });

    const answer = completion.choices?.[0]?.message?.content || '(sin respuesta)';
    return NextResponse.json({ ok: true, answer });

  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
