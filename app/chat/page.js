'use client';

import { useRef, useState } from 'react';
import AuthGuard from '../components/AuthGuard';

export default function ChatPage() {
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        '¡Hola! Puedes subir uno o varios archivos (CSV o Excel) desde “Elegir archivos”. ' +
        'Luego dime qué te interesa analizar (p.ej., “ranking de clientes por beneficio”, ' +
        '“tendencia mensual de ingresos”, “comparativa por carrier”).',
    },
  ]);
  const inputRef = useRef(null);
  const [sending, setSending] = useState(false);

  const handleFileChange = (e) => {
    const f = Array.from(e.target.files || []);
    setFiles(f);
  };

  const sendMessage = async () => {
    const text = (inputRef.current?.value || '').trim();
    if (!text) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    inputRef.current.value = '';

    setSending(true);
    try {
      // Envía archivos + prompt a tu endpoint
      const form = new FormData();
      form.append('prompt', text);
      files.forEach((f) => form.append('files', f, f.name));

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Error');
        throw new Error(errText);
      }

      const data = await res.json().catch(() => ({}));
      const reply =
        data?.reply ||
        data?.text ||
        'OK. He procesado tu petición. (Ajusta el backend para respuestas más ricas)';

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error al procesar: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthGuard>
      <main style={{ maxWidth: 920, margin: '40px auto', padding: '0 16px' }}>
        <section
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          {/* Uploader */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>Adjunta archivos (.csv, .xls, .xlsx)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                multiple
                onChange={handleFileChange}
                style={{ fontSize: 13 }}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {files.length ? `${files.length} archivo(s) seleccionado(s)` : 'Ningún archivo seleccionado'}
              </span>
            </div>
          </div>

          {/* Conversación */}
          <div
            style={{
              display: 'grid',
              gap: 10,
              maxHeight: 420,
              overflow: 'auto',
              paddingRight: 8,
              marginTop: 8,
              marginBottom: 12,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '86%',
                    background: m.role === 'user' ? 'rgba(59,130,246,.15)' : 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.08)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 10 }}>
            <textarea
              ref={inputRef}
              rows={1}
              placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
                resize: 'vertical',
                minHeight: 40,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              style={{
                minWidth: 88,
                borderRadius: 10,
                border: '1px solid #3b82f6',
                background: '#3b82f6',
                color: '#fff',
                fontSize: 14,
                padding: '10px 14px',
                cursor: 'pointer',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
