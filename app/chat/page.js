'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Estilos inline (por si no hay Tailwind)
const wrap = { minHeight: '100vh', background: '#0b0e13', color: '#e5e7eb' };
const container = { maxWidth: 900, margin: '0 auto', padding: '24px' };
const card = { border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: 16 };
const h1 = { fontSize: 20, fontWeight: 600, margin: '0 0 16px' };
const label = { fontSize: 13, color: 'rgba(255,255,255,.8)' };
const list = { marginTop: 8, marginBottom: 8, paddingLeft: 16 };
const msgUser = { background: 'rgba(255,255,255,.12)', borderRadius: 8, padding: 12, fontSize: 14 };
const msgAsst = { background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: 12, fontSize: 14, border: '1px solid rgba(255,255,255,.1)' };
const inputArea = { display: 'flex', gap: 8, alignItems: 'stretch', marginTop: 12 };
const textarea = { flex: 1, background: 'rgba(0,0,0,.3)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: 10, fontSize: 14 };
const button = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 14px', fontWeight: 600, cursor: 'pointer' };

export default function ChatPage() {
  const [workspaceId, setWorkspaceId] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Sube 1..N CSV/XLSX y dime qué necesitas analizar.' }
  ]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);
      setWorkspaceId(ws?.[0]?.id || null);
    })();
  }, []);

  function onFile(e) {
    const arr = Array.from(e.target.files || []);
    setFiles(arr);
  }

  async function send() {
    // Añadimos el prompt del usuario a la conversación
    setMessages(m => [...m, { role: 'user', content: input || '(sin prompt)' }]);
    const currentInput = input;
    setInput('');

    let previewsMarkdown = [];

    if (files.length > 0) {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) {
        setMessages(m => [...m, { role: 'assistant', content: `Error al subir archivos: ${json.error}` }]);
        return;
      }
      previewsMarkdown = json.previewsMarkdown || [];
    }

    const res2 = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,                // por si luego quieres volver a datasets
        previewsMarkdown,           // previews generadas del upload
        prompt: currentInput,
        messages
      }),
    });
    const j = await res2.json();
    if (!j.ok) {
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${j.error}` }]);
      return;
    }
    setMessages(m => [...m, { role: 'assistant', content: j.answer }]);
  }

  return (
    <div style={wrap}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ ...container, paddingTop: 12, paddingBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>Reporting Assistant</div>
          <div style={{ fontSize: 13 }}>
            <a href="/chat" style={{ color: '#e5e7eb' }}>Chat</a>
            <span style={{ opacity: .5 }}> · </span>
            <a href="/workspaces" style={{ color: 'rgba(255,255,255,.7)' }}>Workspaces</a>
            <span style={{ opacity: .5 }}> · </span>
            <a href="/login" style={{ color: 'rgba(255,255,255,.7)' }}>Entrar</a>
          </div>
        </div>
      </div>

      <main style={container}>
        <h1 style={h1}>Chat de reportes</h1>

        <section style={{ ...card, marginBottom: 16 }}>
          <div style={label}><b>Workspace:</b> {workspaceId || '—'}</div>

          <div style={{ marginTop: 10 }}>
            <div style={label}><b>Adjunta archivos</b> (.csv, .xls, .xlsx)</div>
            <input type="file" multiple accept=".csv,.xls,.xlsx" onChange={onFile} style={{ marginTop: 8 }} />
            {files.length > 0 && (
              <ul style={list}>
                {files.map((f, i) => <li key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>{f.name}</li>)}
              </ul>
            )}
          </div>
        </section>

        <section style={card}>
          <div style={{ ...label, marginBottom: 8 }}>Conversación</div>

          <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto', marginBottom: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? msgUser : msgAsst}>{m.content}</div>
            ))}
          </div>

          <div style={inputArea}>
            <textarea
              style={textarea}
              rows={2}
              placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button style={button} onClick={send}>Enviar</button>
          </div>
        </section>

        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 12, marginTop: 32 }}>
          © 2025 Reporting Assistant
        </div>
      </main>
    </div>
  );
}
