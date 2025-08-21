'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function WorkspacesPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
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
      setItems(ws || []);
      setLoading(false);
    }
    init();
  }, []);

  async function createWorkspace() {
    setErr(''); setOk('');
    const name = prompt('Nombre del workspace');
    if (!name) return;
    const { data: w, error: e1 } = await supabase
      .from('workspaces')
      .insert({ name, owner_user_id: user.id })
      .select()
      .single();
    if (e1) { setErr(e1.message); return; }
    await supabase.from('members').insert({ workspace_id: w.id, user_id: user.id, role: 'owner' });
    const { data: ws } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
    setItems(ws || []);
    setOk('Workspace creado');
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  // SHA-256 en hex para guardar huella del archivo
  async function sha256Hex(file) {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // Subir archivo a Storage y registrar en la tabla `files`
  async function onUpload(w, file) {
    try {
      setErr(''); setOk('');
      if (!file) return;
      const allowed = ['xlsx','xls','csv'];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!allowed.includes(ext)) {
        setErr('Solo se permiten .xlsx, .xls o .csv');
        return;
      }

      // Ruta privada: raw/{userId}/{workspaceId}/{timestamp}-{nombre}
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `raw/${user.id}/${w.id}/${ts}-${safeName}`;

      // 1) Subida al bucket privado 'uploads'
      const { error: upErr } = await supabase
        .storage.from('uploads')
        .upload(path, file, { upsert: false });
      if (upErr) { setErr(`Error subiendo archivo: ${upErr.message}`); return; }

      // 2) Registrar en DB
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
    } catch (e) {
      setErr(String(e?.message || e));
    }
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
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => onUpload(w, e.target.files?.[0])}
              />
            </li>
          ))}
          {(!items || items.length === 0) && <li className="card">No hay workspaces todavía.</li>}
        </ul>
      )}
    </div>
  );
}

      .insert({ name, owner_user_id: user.id })
      .select()
      .single();
    if (e1) { setErr(e1.message); return; }
    await supabase.from('members').insert({ workspace_id: w.id, user_id: user.id, role: 'owner' });
    const { data: ws } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
    setItems(ws || []);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <div>
      <h1>Workspaces</h1>
      <div className="row">
        <button onClick={createWorkspace}>Crear workspace</button>
        <button className="secondary" onClick={signOut}>Salir</button>
      </div>
      {err && <div className="err">{err}</div>}
      {loading ? <div>Cargando...</div> : (
        <ul className="list">
          {(items || []).map(w => (
            <li key={w.id} className="card">
              <strong>{w.name}</strong><br/>
              <small>{w.id}</small>
            </li>
          ))}
          {(!items || items.length === 0) && <li className="card">No hay workspaces todavía.</li>}
        </ul>
      )}
    </div>
  );
}
