"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Usa tu cliente público (igual que en app/lib/supabaseClient.js).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const [datasets, setDatasets] = useState([]); // [{id,name,rows}]
  const [attached, setAttached] = useState({}); // id -> true/false

  const [messages, setMessages] = useState([]); // [{role, content}]
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // 1) Carga user y workspace por defecto
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth?.user ?? null);

      // Coge el primer workspace del usuario
      const { data: wss } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1);
      if (wss && wss.length) setWorkspace(wss[0]);
    })();
  }, []);

  // 2) Carga datasets del workspace
  useEffect(() => {
    if (!workspace) return;

    (async () => {
      setError("");
      // Intento 1: tabla "datasets"
      let list = [];
      const tryDatasets = await supabase
        .from("datasets")
        .select("id,name,rows,workspace_id")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (!tryDatasets.error && tryDatasets.data) {
        list = tryDatasets.data;
      } else {
        // Intento 2: tabla "files" (fallback)
        const tryFiles = await supabase
          .from("files")
          .select("id,name,rows,workspace_id,status")
          .eq("workspace_id", workspace.id)
          .in("status", ["processed", "ingested"])
          .order("created_at", { ascending: false });
        if (!tryFiles.error && tryFiles.data) {
          list = tryFiles.data.map((f) => ({
            id: f.id,
            name: f.name,
            rows: f.rows ?? null,
          }));
        }
      }

      setDatasets(list);
      // Auto-selecciona el primero
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
          history: messages.slice(-10) // enviamos el contexto reciente
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error en la petición");
      }

      const data = await res.json();
      if (!data?.answer) throw new Error("Respuesta vacía del modelo.");

      setMessages((m) => [
        ...m,
        { role: "user", content: input.trim() },
        { role: "assistant", content: data.answer }
      ]);
      setInput("");
    } catch (e) {
      setError(e.message || "Falló el envío.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "30px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Chat de reportes</h1>

      {/* Workspace y datasets */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #333", borderRadius: 8 }}>
        <div style={{ marginBottom: 8, opacity: .85 }}>
          <b>Workspace:</b>{" "}
          {workspace?.name || <i>cargando…</i>}
        </div>

        <div>
          <b>Adjunta datasets</b>
          <div style={{ marginTop: 8 }}>
            {datasets.length === 0 ? (
              <div style={{ opacity: .7 }}>No hay datasets listos.</div>
            ) : (
              datasets.map((d) => (
                <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!attached[d.id]}
                    onChange={(e) => setAttached((a) => ({ ...a, [d.id]: e.target.checked }))}
                  />
                  <span>{d.name}</span>
                  {d.rows != null && (
                    <span style={{ opacity: .6, fontSize: 12 }}>· filas: {d.rows}</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conversación */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #333", borderRadius: 8 }}>
        <b>Conversación</b>

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12, minHeight: 120 }}>
          {messages.length === 0 ? (
            <div style={{ opacity: .65 }}>Sin mensajes todavía.</div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{
                background: m.role === "user" ? "rgba(255,255,255,.06)" : "transparent",
                padding: "8px 10px",
                borderRadius: 8
              }}>
                <div style={{ opacity: .7, fontSize: 12, marginBottom: 4 }}>
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

        {/* Error */}
        {error && (
          <div style={{ marginTop: 8, color: "#ff6b6b" }}>
            {error}
          </div>
        )}

        {/* Input */}
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Escribe tu petición: “analiza ventas por cliente y dame acciones”'
            rows={2}
            style={{ flex: 1, padding: 8, borderRadius: 6, background: "rgba(255,255,255,.06)" }}
          />
          <button
            onClick={send}
            disabled={sending}
            style={{
              minWidth: 90,
              borderRadius: 8,
              border: "1px solid #3a8bff",
              background: sending ? "rgba(58,139,255,.45)" : "#3a8bff",
              color: "white",
              fontWeight: 600
            }}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
