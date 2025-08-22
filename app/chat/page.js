'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Dataset = {
  id: string;
  name: string | null;
  rows: number | null;
  status: string | null;
  csv_path: string | null;
  created_at?: string | null;
  workspace_id: string;
};

type Workspace = { id: string; name: string | null };

export default function ChatPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsId, setWsId] = useState<string | null>(null);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([{ role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte hoy? Si tienes algún conjunto de datos adjúntalo y dime qué necesitas analizar.' }]);

  const [input, setInput] = useState('');
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  // Carga workspaces en los que soy miembro
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id,name')
        .order('created_at', { ascending: true });
      if (!error && data) {
        setWorkspaces(data);
        if (!wsId && data.length) setWsId(data[0].id);
      }
    })();
  }, []);

  // Carga datasets “listos para chat”: csv_path no nulo + status válido
  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const { data, error } = await supabase
        .from('datasets')
        .select('id,name,rows,status,csv_path,workspace_id,created_at')
        .eq('workspace_id', wsId)
        .not('csv_path', 'is', null)
        .in('status', ['processed', 'ingested', 'ready'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDatasets(data);
        // Por UX: si no hay nada seleccionado aún, marca el último “ingested/processed”
        const first = data[0]?.id;
        if (first && selectedIds.length === 0) {
          setSelected({ [first]: true });
        }
      } else {
        setDatasets([]);
      }
    })();
  }, [wsId]);

  async function send() {
    const question = input.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Enviamos el workspace y los datasetIds seleccionados
        body: JSON.stringify({
          workspaceId: wsId,
          datasetIds: selectedIds,
          message: question,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error del servidor: ${err}` },
        ]);
        return;
      }

      const json = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: json.answer ?? '(Sin respuesta)' },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Fallo al contactar el servidor: ${e?.message}` },
      ]);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '16px 12px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0 24px' }}>
        <div style={{ fontWeight: 700 }}>Reporting Assistant</div>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <a href="/chat">Chat</a>
          <a href="/workspaces">Workspaces</a>
          <a href="/login">Entrar</a>
          <a href="/signup">Registro</a>
        </nav>
      </header>

      <h2 style={{ margin: '8px 0 16px' }}>Chat de reportes</h2>

      {/* Workspace + datasets */}
      <section style={{ background: '#11151a', border: '1px solid #2a2f36', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ opacity: 0.8 }}>Workspace:</div>
          <select
            value={wsId ?? ''}
            onChange={(e) => {
              setWsId(e.target.value || null);
              setSelected({});
            }}
            style={{ padding: '6px 8px', borderRadius: 6, background: '#0b0e12', border: '1px solid #2a2f36', color: 'white' }}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name ?? w.id}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ opacity: 0.8, marginBottom: 8 }}>Adjunta datasets</div>
          {datasets.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay datasets listos.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {datasets.map((d) => (
                <label key={d.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: '#0b0e12',
                  border: '1px solid #2a2f36',
                  borderRadius: 8,
                  padding: '8px 10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={!!selected[d.id]}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [d.id]: e.target.checked }))
                      }
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {d.name ?? d.id}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {d.status ?? '—'} · filas: {d.rows ?? '¿?'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    {d.csv_path ? 'CSV listo' : 'CSV pendiente'}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Conversación */}
      <section style={{ background: '#11151a', border: '1px solid #2a2f36', borderRadius: 8, padding: 16 }}>
        <div style={{ opacity: 0.8, marginBottom: 8 }}>Conversación</div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              background: m.role === 'user' ? '#0f1318' : '#0b0e12',
              border: '1px solid #2a2f36',
              borderRadius: 8,
              padding: '10px 12px'
            }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                {m.role === 'user' ? 'Tú' : 'Asistente'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
            rows={2}
            style={{
              flex: 1,
              resize: 'vertical',
              minHeight: 44,
              borderRadius: 8,
              border: '1px solid #2a2f36',
              background: '#0b0e12',
              color: 'white',
              padding: 10
            }}
          />
          <button
            onClick={send}
            style={{
              height: 44,
              padding: '0 16px',
              borderRadius: 8,
              background: '#2563eb',
              border: '1px solid #1d4ed8',
              color: 'white',
              fontWeight: 600
            }}
          >
            Enviar
          </button>
        </div>
      </section>

      <footer style={{ opacity: 0.6, fontSize: 12, textAlign: 'center', marginTop: 28 }}>
        © 2025 Reporting Assistant
      </footer>
    </div>
  );
}
