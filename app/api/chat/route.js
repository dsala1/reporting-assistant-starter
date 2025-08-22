// app/api/chat/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || '').trim();
    const previews =
      (Array.isArray(body?.previews) ? body.previews : []) ||
      (Array.isArray(body?.filesMarkdown) ? body.filesMarkdown : []);

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const hasTables = Array.isArray(previews) && previews.length > 0;
    const tablesText = hasTables ? previews.join('\n\n') : '';

    const system = [
      'Eres un analista de datos experto en Excel/CSV.',
      'Responde breve, accionable y con buena estructura.',
      'Si hay tablas en el contexto, utilízalas.',
      'Cuando generes tablas, úsalas en Markdown GFM para que se vean bien.',
    ].join(' ');

    const user = hasTables
      ? `Datos (tablas en Markdown abajo). Luego la petición.\n\n${tablesText}\n\n---\n\nPetición: ${prompt}`
      : `No hay tablas adjuntas. Aun así, responde a la petición con claridad: ${prompt}`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
    });

    const answer =
      completion?.choices?.[0]?.message?.content?.trim() ||
      'No se generó contenido.';

    return NextResponse.json({ answer });
  } catch (err) {
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
