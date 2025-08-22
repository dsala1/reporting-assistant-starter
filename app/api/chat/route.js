// app/api/chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'uploads'; // ← ajusta si tu CSV vive en otro bucket

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, service, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// --- CSV utils muy simples (suficiente para resumen)
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}
function splitCsvLine(line) {
  // separador simplón por comas; si tus CSVs tienen comillas/escapes complejos, podemos mejorar después
  return line.split(',').map(c => c.trim());
}
function sampleRows(header, rows, n = 10) {
  return rows.slice(0, n).map(r => {
    const obj = {};
    header.forEach((h, i) => (obj[h || `col_${i}`] = r[i]));
    return obj;
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { workspaceId, datasetIds, message } = body || {};
    if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

    const ids = Array.isArray(datasetIds) ? datasetIds : [];

    // Cargamos datasets seleccionados con csv_path
    let ds = [];
    if (ids.length) {
      const { data, error } = await admin
        .from('datasets')
        .select('id,name,workspace_id,csv_path')
        .in('id', ids)
        .eq('workspace_id', workspaceId)
        .not('csv_path', 'is', null);

      if (error) throw error;
      ds = data || [];
    }

    // Descargamos y resumimos cada CSV (hasta 50KB cada uno por seguridad)
    const summaries = [];
    for (const d of ds) {
      const path = d.csv_path;
      if (!path) continue;

      const file = await admin.storage.from(FILES_BUCKET).download(path);
      if (!file || !(file instanceof Blob)) continue;

      // Limita tamaño (protección)
      const blob = file.size > 50000 ? file.slice(0, 50000) : file;
      const text = await blob.text();

      const { header, rows } = parseCsv(text);
      const sample = sampleRows(header, rows, 12);

      summaries.push({
        id: d.id,
        name: d.name || d.id,
        columns: header,
        preview: sample,
        totalRows: rows.length
      });
    }

    // Montamos prompt: contexto con tablas disponibles + pregunta del usuario
    const context = summaries.length
      ? `Tienes acceso a ${summaries.length} dataset(s). Para cada uno te doy columnas y unas filas de muestra en JSON.
${JSON.stringify(summaries, null, 2)}`
      : 'No hay datasets adjuntos. Responde en base a la pregunta solo.';

    const sys = `Eres un analista de datos. Responde de forma clara, con tablas y conclusiones accionables en español. 
- Si hay datasets, úsalos exclusivamente para responder; si faltan columnas o hay ambigüedad, pide precisión. 
- Cuando hagas tablas, usa Markdown con encabezados y alinea correctamente.
- Si calculas ratios (beneficio/income, etc.), indícalo y muestra 2 decimales.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `${context}\n\nPregunta del usuario: ${message}` },
      ],
      temperature: 0.2,
    });

    const answer =
      completion?.choices?.[0]?.message?.content ??
      'No he podido generar respuesta.';

    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    console.error(e);
    return new NextResponse(
      e?.message || 'Unexpected error',
      { status: 500 }
    );
  }
}
