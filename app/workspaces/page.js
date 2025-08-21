'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function WorkspacesPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [fileMap, setFileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      if (!u) { window.location.href = '/login'; return; }
      const { data: ws, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) setErr(error.message);
      const list = ws || [];
      setItems(list);
      await loadFiles(list);
      setLoading(false);
    }
    init();
  }, []);

  async function loadFiles(wsList) {
    const map = {};
    for (const w of wsList || []) {
      const { data: files } = await supabase
        .from('files')
        .select('*')
        .eq('workspace_id', w.id)
        .order('created_at', { ascending: false });
      map[w.id] = files || [];
    }
    setFileMap(map);
  }

  async function refreshWorkspaceFiles(w) {
    const { data: files } = await supabase
      .from('files')
      .select('*')
      .eq('workspace_id', w.id)
      .order('created_at', { ascending: false });
    setFileMap(prev => ({ ...prev, [w.id]: files || [] }));
  }

  async function createWorkspace() {
    setErr(''); setOk('');
    const name = prompt('Nombre del workspace');
    if (!name) return;
    const { data: w, error: e1 } = await supabase
      .from('workspaces')
      .insert({ name, owner_user_id: (user && user.id) || '' })
      .select()
      .single();
    if (e1) { setErr(e1.message); return; }
    await supabase.from('members')
      .insert({ workspace_id: w.id, user_id: user.id, role: 'owner' });
    const { data: ws } = await supabase
      .from('workspaces').select('*').order('created_at', { ascending: false });
    setItems(ws || []);
    await loadFiles(ws || []);
    setOk('Workspace creado');
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function sha256Hex(file) {
    try {
      if (typeof window === 'undefined' || !window.crypto?.subtle) return 'no-hash';
      const buf = await file.arrayBuffer();
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch { return 'no-hash'; }
  }

  async function onUpload(w, file) {
    try {
      setErr(''); setOk('');
      if (!file) return;
      const allowed = ['xlsx','xls','csv'];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!allowed.includes(ext)) { setErr('Solo se permiten .xlsx, .xls o .csv'); return; }

      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `raw/${user.id}/${w.id}/${ts}-${safeName}`;

      const { error: upErr } = await supabase
        .storage.from('uploads')
        .upload(path, file, { upsert: false });
      if (upErr) { setErr(`Error subiendo archivo: ${upErr.message}`); return; }

      const hash = await sha256Hex(file);
      const { error: dbErr } = await supabase.from('files').insert({
        workspace_id: w.id,
        filename: file.name,
        storage_path: path,
        bytes: file.size,
        sha256: hash,
        status: 'uploaded'
      });
      if (dbErr) { setErr(`Subido pero NO registrado en DB: ${dbErr.message}`); return; }

      setOk('Archivo subido y registrado correctamente');
      await refreshWorkspaceFiles(w);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function downloadFile(f) {
    try {
      const { data, error } = await supabase
        .storage.from('uploads')
        .createSignedUrl(f.storage_path, 60);
      if (error) { setErr(error.message); return; }
      window.open(data.signedUrl, '_blank');
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  function fmtBytes(n) {
    if (n == null) return '-';
    if (n < 1024) return `${n} B`;
    if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1024/1024).toFixed(1)} MB`;
  }

  return (
    <div>
      <h1>Workspaces</h1>
      <div className="row" style={{marginTop:12, marginBottom:12}}>
        <button onClick={createWorkspace}>Crear workspace</button>
        <button className="secondary" onClick={signOut}>Salir</button>
      </div>

      {err && <div className="err">{err}</div>}
      {ok && <div style={{color:'#7bffb7'}}>{ok}</div>}

      {loading ? <div>Cargando...</div> : (
        <ul className="list">
          {(items || []).map(w => (
            <li key={w.id} className="card">
              <strong>{w.name}</strong><br/>
              <small>{w.id}</small>

              <div className="spc" />
              <label>Subir archivo (.xlsx/.xls/.csv): </label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => onUpload(w, e.target.files?.[0])} />

              <div className="spc" />
              <div><em>Archivos</em></div>
              <ul className="list" style={{marginLeft:0}}>
                {(fileMap[w.id] || []).map(f => (
                  <li key={f.id} className="card">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div><strong>{f.filename}</strong></div>
                        <small>{fmtBytes(f.bytes)} · {f.status}</small>
                      </div>
                      <button className="secondary" onClick={() => downloadFile(f)}>Descargar</button>
                    </div>
                  </li>
                ))}
                {(!fileMap[w.id] || fileMap[w.id].length === 0) && (
                  <li className="card">Aún no hay archivos.</li>
                )}
              </ul>
            </li>
          ))}
          {(!items || items.length === 0) && <li className="card">No hay workspaces todavía.</li>}
        </ul>
      )}
    </div>
  );
}
