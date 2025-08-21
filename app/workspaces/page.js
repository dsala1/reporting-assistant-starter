'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

export default function WorkspacesPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);       // workspaces
  const [fileMap, setFileMap] = useState({});   // { [workspaceId]: files[] }
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
      .insert({ name, owner_user_id: user?.id || '' })
      .select()
      .single();

    if (e1) { setErr(e1.message); return; }

    await supabase
      .from('members')
      .insert({ workspace_id: w.id, user_id: user.id, role: 'owner' });

    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    setItems(ws || []);
    await loadFiles(ws || []);
    setOk('Workspace creado');
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  // Hash en cliente (si está disponible). Si no, devuelve 'no-hash'
  async function sha256Hex(file) {
    try {
      if (typeof window === 'undefined' || !window.crypto?.subtle) return 'no-hash';
      const buf = await file.arrayBuffer();
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { return 'no-hash'; }
  }

  // Lee Excel/CSV en el navegador y guarda metadata en la fila de `files`
  async function processLocally(file, fileRow) {
    try {
      const name = file.name.toLowerCase();
      let meta = { type: 'unknown' };

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        const sheets = wb.SheetNames;
        const first = wb.Sheets[sheets[0]];
        const rows = XLSX.utils.sheet_to_json(first, { header: 1, raw: true });
        const header = (rows[0] || []).map(v => String(v ?? ''));
        meta = {
          type: 'excel',
          sheets,
          first_sheet: sheets[0],
          columns: header,
          rows_count: Math.max((rows.length || 0) - 1, 0)
        };
      } else if (name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const header = (lines[0] || '').split(',').map(s => s.trim());
        meta = {
          type: 'csv',
          columns: header,
          rows_count: Math.max(lines.length - 1, 0)
        };
      }

      const { error } = await supabase.from('files')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          meta
        })
        .eq('id', fileRow.id);

      if (error) throw error;
      setOk('Archivo procesado');
      const w = items.find(x => x.id === fileRow.workspace_id);
      if (w) await refreshWorkspaceFiles(w);
    } catch (e) {
      setErr('Procesado local falló: ' + (e?.message || e));
    }
  }

  // Subida a Storage + inserción en `files` + procesado local
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

      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `raw/${user.id}/${w.id}/${ts}-${safeName}`;

      // 1) Subir al bucket privado 'uploads'
      const { error: upErr } = await supabase
        .storage.from('uploads')
        .upload(path, file, { upsert: false });
      if (upErr) { setErr(`Error subiendo archivo: ${upErr.message}`); return; }

      // 2) Insertar fila en `files`
      const hash = await sha256Hex(file);
      const { data: inserted, error: dbErr } = await supabase
        .from('files')
        .insert({
          workspace_id: w.id,
          filename: file.name,
          storage_path: path,
          bytes: file.size,
          sha256: hash,
          status: 'uploaded'
        })
        .select()
        .single();
      if (dbErr) { setErr(`Subido pero NO registrado en DB: ${dbErr.message}`); return; }

      setOk('Archivo subido y registrado correctamente');
      await refreshWorkspaceFiles(w);

      // 3) Procesar en cliente para metadata
      await processLocally(file, inserted);
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
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => onUpload(w, e.target.files?.[0])}
              />

              <div className="spc" />
              <div><em>Archivos</em></div>
              <ul className="list" style={{marginLeft:0}}>
                {(fileMap[w.id] || []).map(f => (
                  <li key={f.id} className="card">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
                      <div>
                        <div><strong>{f.filename}</strong></div>
                        <small>{fmtBytes(f.bytes)} · {f.status}</small><br/>
                        {f.meta && (
                          <small>
                            {f.meta.type === 'excel' && `Hojas: ${f.meta.sheets?.join(', ')} · Filas: ${f.meta.rows_count}`}
                            {f.meta.type === 'csv' && `CSV · Columnas: ${(f.meta.columns||[]).length} · Filas: ${f.meta.rows_count}`}
                          </small>
                        )}
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
