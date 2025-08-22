import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Config
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'uploads';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

if (!URL || !SERVICE_KEY) {
  console.warn('Faltan credenciales de Supabase en el entorno del servidor.');
}
if (!OPENAI_KEY) {
  console.warn('Falta OPENAI_API_KEY en el entorno.');
}

const admin =
  URL && SERVICE_KEY ? createClient(URL, SERVICE_KEY, { auth: { persistSession: false } }) : null;
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// -------- CSV utils sencillos --------
function splitCsvLine(line) {
  return line.split(',').map((c) => c.trim());
}

function parseCsv(text) {
  const lines = (text || '').split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}

function sampleRows(header, rows, n = 12) {
  return rows.slice(0, n).map((r) => {
    const obj = {};
    header.forEach((h, i) => (obj[h || `col_${i}`] = r[i]));
    return obj;
  });
}

// Lee un archivo de Storage y devuelve texto (vale para Node o Browser)
async function readStorageFileAsText(bucket, path) {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) throw error || new Error('File download failed');

  // En navegador: Blob tiene .text(); en Node: viene como ReadableStream/Bufferizable
  if (typeof data.text === 'function') {
    return await data.text();
  }
  if (typeof data.arrayBuffer === 'function') {
    const buf = Buffer.from(await data.arrayBuffer());
    return buf.toString('utf-8');
  }
  // Node ReadableStream
  if (typeof data.getReader === 'function') {
    const reader = data.getReader();
    const chunks = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  // Último recurso: intentar toString
  return String(data);
}

export async function POST(req) {
  try {
    if (!admin) return new NextResponse('Server misconfigured (Supabase)', { status: 500 });
    if (!openai) return new NextResponse('Server misconfigured (OpenAI)', { status: 500 });

    const body = await req.json();
    const { workspaceId, datasetIds, message } = body || {};
    if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

    const ids = Array.isArray(datasetIds) ? datasetIds : [];

    // Busca datasets seleccionados con csv_path
    let datasets = [];
    if (ids.length) {
      const { data, error } = await admin
        .from('datasets')
        .select('id,name,workspace_id,csv_path')
        .in('id', ids)
        .eq('workspace_id', workspaceId)
        .not('csv_path', 'is', null);

      if (error) throw error;
      datasets = data || [];
    }

    // Descarga CSVs y construye resumenes
    const summaries = [];
    for (const d of datasets) {
      if (!d.csv_path) continue;

      // lee el CSV como texto (funciona en Vercel)
      let text = await readStorageFileAsText(FILES_BUCKET, d.csv_path);

      // limita a ~50KB para prompt
      if (text.length > 50_000) text = text.slice(0, 50_000);

      const { header, rows } = parseCsv(text);
      const preview = sampleRows(header, rows, 12);

      summaries.push({
        id: d.id,
        name: d.name || d.id,
        columns: header,
        preview,
        totalRows: rows.length,
      });
    }

    const context = summaries.length
      ? `Tienes acceso a ${summaries.length} dataset(s). Para cada uno te doy columnas y unas filas de muestra en JSON.
${JSON.stringify(summaries, null, 2)}`
      : 'No hay datasets adjuntos. Responde en base a la pregunta solo.';

    const system = `Eres un analista de datos senior. Responde en español con tablas Markdown limpias y conclusiones accionables.
- Usa solo las columnas provistas.
- Si calculas ratios, muéstralos con 2 decimales.
- Cuando corresponda, añade recomendaciones claras.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `${context}\n\nPregunta del usuario: ${message}` },
      ],
      temperature: 0.2,
    });

    const answer = completion?.choices?.[0]?.message?.content ?? 'No he podido generar respuesta.';
    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    console.error(e);
    return new NextResponse(e?.message || 'Unexpected error', { status: 500 });
  }
}
