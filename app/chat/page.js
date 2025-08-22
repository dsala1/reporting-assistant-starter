'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ChatPage() {
  const [workspaceId, setWorkspaceId] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [checked, setChecked] = useState({});
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '¡Hola! ¿En qué puedo ayudarte hoy? Si tienes uno o varios datasets (CSV) en tu workspace, márcalos y dime qué necesitas analizar.',
    },
  ]);
  const [input, setInput] = useState('');

  // Carga primer workspace del usuario y sus datasets
  useEffect(() => {
    (async () => {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);

      const wid = ws?.[0]?.id || null;
      setWorkspaceId(wid);

      if (!wid) {
        setDatasets([]);
        return;
      }

      const { data: ds } = await supabase
        .from('datasets')
        .select('id,name,ready,rows_count,created_at')
        .eq('workspace_id', wid)
        .order('created_at', { ascending: false });

      setDatasets(ds || []);
    })();
  }, []);

  const toggle = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const send = async () => {
    if (!workspaceId) {
      setMessages((m) => [...m, { role: 'assistant', content: 'No encuentro tu workspace.' }]);
      return;
    }
    const fileIds = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setMessages((m) => [...m, { role: 'user', content: input }]);
    setInput('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        fileIds,
        prompt: input,
        messages,
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${json.error}` }]);
      return;
    }
    setMessages((m) => [...m, { role: 'assistant', content: json.answer }]);
  };

  return (
    <div className="min-h-screen bg-[#0b0e13] text-gray-100">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="font-semibold">Reporting Assistant</div>
          <nav className="text-sm space-x-4">
            <a href="/chat" className="text-white/80 hover:text-white">Chat</a>
            <a href="/workspaces" className="text-white/60 hover:text-white">Workspaces</a>
            <a href="/login" className="text-white/60 hover:text-white">Entrar</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold mb-4">Chat de reportes</h1>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
          <div className="text-sm text-white/80">
            <div className="mb-2">
              <span className="font-medium">Workspace:</span>{' '}
              {workspaceId ? workspaceId : '—'}
            </div>
            <div>
              <div className="font-medium mb-2">Adjunta datasets</div>
              {datasets.length === 0 ? (
                <div className="text-white/60">No hay datasets listos.</div>
              ) : (
                <ul className="space-y-2">
                  {datasets.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!d.ready}
                          checked={!!checked[d.id]}
                          onChange={() => toggle(d.id)}
                        />
                        <span className="text-sm">
                          {d.name || d.id}{' '}
                          {d.ready ? (
                            <span className="text-green-400">(listo)</span>
                          ) : (
                            <span className="text-yellow-400">(procesando)</span>
                          )}
                        </span>
                      </label>
                      {typeof d.rows_count === 'number' ? (
                        <span className="text-xs text-white/50">{d.rows_count} filas</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium mb-2">Conversación</div>
          <div className="space-y-3 mb-4 max-h-[360px] overflow-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-white/10'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <textarea
              className="flex-1 rounded-md bg-black/30 border border-white/10 p-3 text-sm"
              rows={2}
              placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              onClick={send}
              className="rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium"
            >
              Enviar
            </button>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-white/40">
        © 2025 Reporting Assistant
      </footer>
    </div>
  );
}
