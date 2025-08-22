'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  // Estado básico del chat
  const [filesPreview, setFilesPreview] = useState([]); // array de markdown (uno por archivo)
  const [filesList, setFilesList] = useState([]); // nombres de archivos adjuntos
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '¡Hola! Sube 1..N CSV/XLSX desde el botón de arriba y dime qué necesitas analizar.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Autoscroll al final cuando hay cambios
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subida de archivos al endpoint /api/upload
  async function handleFilesChange(e) {
    try {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const form = new FormData();
      files.forEach((f) => form.append('files', f));

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Error subiendo archivos');
      }

      // Guardamos previews markdown y nombres para chips
      setFilesPreview(data.previewsMarkdown || []);
      setFilesList(files.map((f) => f.name));

      // Mensaje del asistente confirmando adjuntos
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `He recibido ${files.length} archivo${
            files.length > 1 ? 's' : ''
          }. Cuando me digas qué buscas, los analizo.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error al subir archivos: ${err.message}` },
      ]);
    } finally {
      // Limpia el input de archivos para permitir volver a subir los mismos si se quiere
      e.target.value = '';
    }
  }

  // Enviar prompt al backend /api/chat con las previews
  async function handleSend() {
    const prompt = (input || '').trim();
    if (!prompt || sending) return;

    // pinta el mensaje del usuario
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Mandamos el prompt y las previews (markdown) al servidor
        body: JSON.stringify({
          prompt,
          previews: filesPreview, // <- deja esto así; tu route ya lo estaba usando
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Error generando respuesta');
      }

      // Intentamos recoger la respuesta bajo varias keys posibles
      const text =
        data.answer || data.message || data.content || data.text || '(respuesta vacía)';

      setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Enter para enviar, Shift+Enter hace salto de línea
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-shell">
      <header className="chat-topbar">
        <div className="brand">Reporting Assistant</div>
        <nav className="nav">
          <a href="/chat">Chat</a>
          <a href="/workspaces">Workspaces</a>
          <a href="/login">Entrar</a>
        </nav>
      </header>

      <main className="chat-main">
        <section className="panel">
          <div className="panel-title">Chat de reportes</div>

          {/* Adjuntos */}
          <div className="attachments">
            <div className="row">
              <label className="label">Adjunta archivos (.csv, .xls, .xlsx)</label>
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
              </div>
            )}
          </div>

          {/* Conversación */}
          <div className="messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`bubble ${m.role}`}>
                <div className="avatar">{m.role === 'user' ? '🧑' : '🤖'}</div>
                <div className="content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {sending && (
              <div className="bubble assistant">
                <div className="avatar">🤖</div>
                <div className="content typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Caja de envío */}
          <div className="sendbar">
            <textarea
              className="input"
              placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
            />
            <button className="btn" onClick={handleSend} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </section>
      </main>

      <footer className="chat-footer">© {new Date().getFullYear()} Reporting Assistant</footer>
    </div>
  );
}
