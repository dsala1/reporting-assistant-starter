'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [ws, setWs] = useState(null);

  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState({}); // { dataset_id: boolean }

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      setUser(u);
      if (!u) { window.location.href = '/login'; return; }

      const { data: ws } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
      setWorkspaces(ws || []);
      if (ws && ws.length) setWs(ws[0]);
    })();
  }, []);

  useEffect(() => {
    if (!ws) return;
    (async () => {
      const { data: ds } = await supabase
        .from('datasets')
        .select('*')
        .eq('workspace_id', ws.id)
        .order('created_at', { ascending: false });
      setDatasets(ds || []);

      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .eq('workspace_id', ws.id)
        .order('created_at', { ascending: false })
        .limit(1);
      let convId = convs?.[0]?.id;
      if (!convId) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ workspace_id: ws.id, user_id: user.id, title: 'Chat de reportes' })
          .select()
          .single();
        convId = created.id;
      }
      setConversationId(convId);

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
    })();
  }, [ws]);

  async function sendPrompt() {
    try {
      setErr('');
      if (!input.trim() || !conversationId) return;
      setBusy(true);

      const { data: uMsg, error: mErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: input.trim()
        })
        .select()
        .single();
      if (mErr) throw mErr;

      const datasetIds = Object.entries(selected).filter(([id, on]) => !!on).map(([id]) => id);

      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          workspace_id: ws.id,
          message_id: uMsg.id,
          prompt: input.trim(),
          dataset_ids: datasetIds
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'chat failed');

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
      setInput('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>Chat de reportes</h1>
      {err && <div className="err">{err}</div>}

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <label>Workspace:</label>
        <select
          value={ws?.id || ''}
          onChange={e => setWs(workspaces.find(x => x.id === e.target.value))}
        >
          {(workspaces || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <strong>Adjunta datasets</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 8 }}>
          {(datasets || []).map(d => (
            <label key={d.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <span>
                {d.filename} <small style={{ opacity: .7 }}>· filas: {d.rows_count ?? '-'}</small>
              </span>
              <input
                type="checkbox"
                checked={!!selected[d.id]}
                onChange={e => setSelected(s => ({ ...s, [d.id]: e.target.checked }))}
              />
            </label>
          ))}
          {(!datasets || datasets.length === 0) && <div>No hay datasets aún.</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <strong>Conversación</strong>
        <div style={{ marginTop: 8, maxHeight: 350, overflowY: 'auto' }}>
          {(messages || []).map(m => (
            <div key={m.id} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{m.role === 'assistant' ? 'Asistente' : 'Tú'}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
          {(!messages || messages.length === 0) && <div>Sin mensajes todavía.</div>}
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu petición: “analiza ventas por país y dime riesgos y acciones”"
          rows={3}
          style={{ flex: 1 }}
        />
        <button onClick={sendPrompt} disabled={busy || !input.trim()}>
          {busy ? 'Pensando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
