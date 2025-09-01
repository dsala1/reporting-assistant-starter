import AuthGuard from '../components/AuthGuard';
'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const [filesPreview, setFilesPreview] = useState([]);   // markdown de tablas
  const [filesList, setFilesList] = useState([]);         // nombres de archivo
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '¡Hola! Puedes subir uno o varios archivos (CSV o Excel) con tus datos desde "Elegir archivos". ' +
  'Después, cuéntame qué quieres analizar. ' +
  'Ejemplos: “ranking de clientes por beneficio”, “tendencia mensual de ingresos”, “comparativa por carrier”.'
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleFilesChange(e) {
    try {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const form = new FormData();
      files.forEach((f) => form.append('files', f));

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Error de subida');

      setFilesPreview(data.previewsMarkdown || []);
      setFilesList(files.map((f) => f.name));

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Recibido: ${files.length} archivo${
            files.length > 1 ? 's' : ''
          }. Indícame tu petición y los uso en el análisis.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error al subir archivos: ${err.message}` },
      ]);
    } finally {
      e.target.value = '';
    }
  }

  async function handleSend() {
    const prompt = (input || '').trim();
    if (!prompt || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setInput('');
    setSending(true);

    try {
      const payload = {
        prompt,
        previews: filesPreview,         // clave que espera el back
        filesMarkdown: filesPreview,     // redundancia por compatibilidad
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'Error generando respuesta');

      const text =
        data.answer || data.message || data.content || data.text || '(sin contenido)';

      setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Reporting Assistant</div>
        <nav className="nav">
          <a href="/chat">Chat</a>
          <a href="/workspaces">Workspaces</a>
          <a href="/login">Entrar</a>
        </nav>
      </header>

      <main className="container">
        <section className="card">
          <div className="card-head">
            <h1>Chat de reportes</h1>
          </div>

          <div className="attach">
            <label className="attach-label">Adjunta archivos (.csv, .xls, .xlsx)</label>
            <div className="attach-row">
              <input
                type="file"
                multiple
                accept=".csv,.xls,.xlsx"
                onChange={handleFilesChange}
              />
            </div>

            {filesList.length > 0 && (
              <div className="chips">
                {filesList.map((name, i) => (
                  <span key={i} className="chip" title={name}>
                    {name}
                  </span>
                ))}
                <span className="chip use">Usando {filesList.length}</span>
              </div>
            )}
          </div>

          <div className="messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`row ${m.role}`}>
                <div className="badge">{m.role === 'user' ? 'U' : 'A'}</div>
                <div className="bubble">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}

            {sending && (
              <div className="row assistant">
                <div className="badge">A</div>
                <div className="bubble typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="send">
            <textarea
              className="input"
              rows={2}
              placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="btn" onClick={handleSend} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </section>
      </main>

      <footer className="foot">© {new Date().getFullYear()} Reporting Assistant</footer>
    </div>
  );
}
