// app/api/chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Supabase admin (server)
const admin = createClient(url, service, { auth: { persistSession: false } });

// --- utils ---
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(l => l.split(','));
  return { header, rows };
}

function summarizeTable(header, rows, rowCap = 200) {
  const sample = rows.slice(0, rowCap);
  const numericIdx = header.map((_, i) => i)
    .filter(i => sample.some(r => r[i] !== undefined && r[i] !== '' && !Number.isNaN(Number(r[i]))));

  const stats = {};
  for (const i of numericIdx) {
    let cnt = 0, sum = 0, min = Infinity, max = -Infinity;
    for (const r of sample) {
      const v = Number(r[i]); if (Number.isNaN(v)) continue;
      cnt++; sum += v; if (v < min) min = v; if (v > max) max = v;
    }
    stats[header[i]] = { count: cnt, avg: cnt ? sum / cnt : null, min: isFinite(min) ? min : null, max: isFinite(max) ? max : null };
  }

  return {
    header,
    rows_count: rows.length,
    sample: sample.slice(0, 20),
    numeric_summary: stats
  };
}

export async function POST(req) {
  try {
    const { conversation_id, workspace_id, message_id, prompt, dataset_ids } = await req.json();
    if (!conversation_id || !workspace_id || !message_id || !prompt) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 });
    }

    // conversación pertenece al workspace
    const { data: conv, error: cErr } = await admin
      .from('conversations')
      .select('id, workspace_id')
      .eq('id', conversation_id)
      .single();
    if (cErr || !conv || conv.workspace_id !== workspace_id) {
      return NextResponse.json({ error: 'conversation/workspace mismatch' }, { status: 403 });
    }

    // datasets
    const ids = Array.isArray(dataset_ids) ? dataset_ids : [];
    const { data: dsRows, error } = await admin
      .from('datasets')
      .select('id, filename, storage_path')
      .in('id', ids)
      .eq('workspace_id', workspace_id);
    if (error) throw error;

    // descargar y resumir
    const summaries = [];
    for (const d of dsRows || []) {
      const dl = await admin.storage.from('datasets').download(d.storage_path);
      if (dl.error) throw dl.error;
      const text = Buffer.from(await dl.data.arrayBuffer()).toString('utf-8');
      const parsed = parseCsv(text);
      summaries.push({
        id: d.id,
        filename: d.filename,
        summary: summarizeTable(parsed.header, parsed.rows)
      });
    }

    const system = `Eres un analista de datos senior. Responde en el idioma del usuario si se infiere del prompt (por defecto, español).
- Usa solo los datos adjuntos (resúmenes y muestras).
- Estructura el informe con: Resumen ejecutivo, Hallazgos, Tablas resumidas (si aplica), Conclusiones y Acciones.
- No inventes; si algo no está en los datos, dilo.`;

    const context = JSON.stringify(summaries).slice(0, 100000);

    const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Datos adjuntos (resumen JSON): ${context}` },
        { role: 'user', content: `Instrucción del usuario: ${prompt}` }
      ],
      temperature: 0.2
    });

    const answer = completion.choices?.[0]?.message?.content || 'No se generó respuesta.';

    // guarda respuesta
    const { data: aMsg, error: mErr } = await admin
      .from('messages')
      .insert({ conversation_id, user_id: null, role: 'assistant', content: answer })
      .select()
      .single();
    if (mErr) throw mErr;

    // enlaza adjuntos (trazabilidad)
    if (dsRows && dsRows.length) {
      const links = dsRows.map(d => ({ message_id, dataset_id: d.id }));
      await admin.from('message_files').insert(links);
    }

    return NextResponse.json({ ok: true, message_id: aMsg.id, answer });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
