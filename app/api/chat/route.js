// app/api/chat/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Admin (server) Supabase client
const admin = createClient(url, service, { auth: { persistSession: false } });

// Forma CSV a partir de filas [{col1:..., col2:...}, ...]
function rowsToCsv(rows) {
  if (!rows || !rows.length) return "";
  const headers = Object.keys(rows[0]);
  const head = headers.join(",");
  const body = rows.map(r =>
    headers.map(h => {
      const v = r[h] ?? "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(",")
  ).join("\n");
  return head + "\n" + body;
}

// Intenta obtener preview de un dataset (varias posibles tablas)
async function fetchDatasetPreview(datasetId) {
  // 1) dataset_rows (ideal)
  let rows = null;
  let error = null;

  const try1 = await admin
    .from("dataset_rows")
    .select("*")
    .eq("dataset_id", datasetId)
    .limit(200);

  if (!try1.error && try1.data && try1.data.length) {
    rows = try1.data;
  } else {
    // 2) files_preview (fallback)
    const try2 = await admin
      .from("files_preview")
      .select("*")
      .eq("file_id", datasetId)
      .limit(200);
    if (!try2.error && try2.data && try2.data.length) {
      rows = try2.data;
    } else {
      // 3) datasets (si guarda csv_text)
      const try3 = await admin
        .from("datasets")
        .select("csv_text")
        .eq("id", datasetId)
        .single();
      if (!try3.error && try3.data?.csv_text) {
        return try3.data.csv_text;
      }
      error = try1.error || try2.error || try3.error;
    }
  }

  if (rows && rows.length) return rowsToCsv(rows);
  if (error && process.env.NODE_ENV !== "production") console.error(error);
  return "";
}

export async function POST(req) {
  try {
    const { prompt, workspaceId, datasetIds = [], history = [] } = await req.json();

    // Construimos contexto con previews CSV de datasets
    let contextParts = [];
    for (const id of datasetIds) {
      const csv = await fetchDatasetPreview(id);
      if (csv) {
        // recortamos si es excesivo
        const lines = csv.split(/\r?\n/).slice(0, 250).join("\n");
        contextParts.push(`Dataset ${id} (primeras filas):\n${lines}`);
      }
    }

    const context = contextParts.join("\n\n");

    // Mensajes al modelo (estilo chat)
    const messages = [
      {
        role: "system",
        content:
          "Eres un analista de datos que escribe en el idioma del usuario. " +
          "Cuando haya datos en contexto, responde con un breve resumen ejecutivo, " +
          "una tabla Markdown clara (usa | y separadores) y una sección de conclusiones/acciones. " +
          "No inventes columnas; trabaja solo con lo que recibes. Si no hay datos útiles, " +
          "pide un dataset o explica qué falta."
      },
      ...history.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      })),
      {
        role: "user",
        content:
          (context ? `Contexto de datos (CSV):\n${context}\n\n` : "") +
          `Instrucción del usuario: ${prompt}`
      }
    ];

    // Modelo recomendado: equilibrado en coste y calidad
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages
    });

    const answer = completion.choices?.[0]?.message?.content || "Sin respuesta.";
    return NextResponse.json({ ok: true, answer });
  } catch (err) {
    console.error(err);
    return new NextResponse(
      typeof err === "string" ? err : (err?.message || "Server error"),
      { status: 500 }
    );
  }
}
