"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const [datasets, setDatasets] = useState([]); // [{id,name,rows}]
  const [attached, setAttached] = useState({}); // id -> true/false

  const [messages, setMessages] = useState([]); // [{role, content}]
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth?.user ?? null);

      const { data: wss } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1);

      if (wss && wss.length) setWorkspace(wss[0]);
    })();
  }, []);

  useEffect(() => {
    if (!workspace) return;
    (async () => {
      setError("");

      // 1) datasets (si existe)
      let list = [];
      const ds = await supabase
        .from("datasets")
        .select("id,name,rows,workspace_id")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (!ds.error && ds.data) {
        list = ds.data;
      } else {
        // 2) files (fallback)
        const fs = await supabase
          .from("files")
          .select("id,name,rows,workspace_id,status")
          .eq("workspace_id", workspace.id)
          .in("status", ["processed", "ingested"])
          .order("created_at", { ascending: false });
        if (!fs.error && fs.data) {
          list = fs.data.map(f => ({ id: f.id, name: f.name, rows: f.rows ?? null }));
        }
      }

      setDatasets(list);
      const first = list[0]?.id;
      if (first) setAttached({ [first]: true });
    })();
  }, [workspace]);

  const attachedIds = useMemo(
    () => Object.entries(attached).filter(([, v]) => !!v).map(([k]) => k),
    [attached]
  );

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input.trim(),
          workspaceId: workspace?.id ?? null,
          datasetIds: attachedIds,
          history: messages.slice(-10),
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data?.answer) throw new Error("Respuesta vacía del modelo.");

      setMessages(m => [
        ...m,
        { role: "user", content: input.trim() },
        { role: "assistant", content: data.answer },
      ]);
      setInput("");
    } catch (e) {
      setError(e.message || "Falló el envío.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <h1 style={{fontSize: 26, fontWeight: 800, marginTop: 8}}>Chat de reportes</h1>

      {/* Datos del workspace */}
      <section className="card">
        <div style={{opacity:.85, marginBottom: 8}}>
          <b>Workspace:</b> {workspace?.name || <i>cargando…</i>}
        </div>

        <div>
          <b>Adjunta datasets</b>
          <div style={{ marginTop: 8 }}>
            {datasets.length === 0 ? (
              <div style={{ opacity: .7 }}>No hay datasets listos.</div>
            ) : (
              datasets.map(d => (
                <label key={d.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!attached[d.id]}
                    onChange={e => setAttached(a => ({ ...a, [d.id]: e.target.checked }))}
                  />
                  <span>{d.name}</span>
                  {d.rows != null && <small>· filas: {d.rows}</small>}
                </label>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Conversación */}
      <section className="card">
        <b>Conversación</b>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, minHeight: 120 }}>
          {messages.length === 0 ? (
            <div style={{ opacity: .65 }}>Sin mensajes todavía.</div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className="card"
                style={{
                  background: m.role === "user" ? "rgba(255,255,255,.06)" : "var(--panel)",
                  borderColor: "var(--border)"
                }}
              >
                <div style={{ opacity: .7, fontSize: 12, marginBottom: 6 }}>
                  {m.role === "user" ? "Tú" : "Asistente"}
                </div>
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          )}
        </div>

        {error && <div style={{ marginTop: 10, color: "var(--danger)" }}>{error}</div>}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
            rows={2}
          />
          <button onClick={send} disabled={sending} className="btn btn-primary" style={{ minWidth: 110 }}>
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </section>
    </>
  );
}
