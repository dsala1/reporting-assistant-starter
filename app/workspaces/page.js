'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

// ---------- Utils ----------
function fmtBytes(n) {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function sha256Hex(file) {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return 'no-hash';
    const buf = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'no-hash'; }
}

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const header = (lines[0] || '').split(',').map(s => s.trim());
  const rows = lines.slice(1).map(r => r.split(','));
  return { header, rows };
}

function parseExcelArrayBuffer(buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = wb.SheetNames;
  const first = wb.Sheets[sheets[0]];
  const rows = XLSX.utils.sheet_to_json(first, { header: 1, raw: true });
  const header = (rows[0] || []).map(v => String(v ?? ''));
  return { sheets, header, rows: rows.slice(1) };
}

// ---------- Page ----------
export default function WorkspacesPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);            // workspaces
  const [fileMap, setFileMap] = useState({});        // { [workspaceId]: files[] }
  const [datasetMap, setDatasetMap] = useState({});  // { [workspaceId]: datasets[] }
  const [previewMap, setPreviewMap] = useState({});  // { [fileId]: { columns, rows } }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // -------- init --------
  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      if (!u) { window.location.href = '/login'; return; }

      const { data: ws, error } = await supabase
        .from('workspaces').select('*')
        .order('created_at', { ascending: false });
      if (error) setErr(error.message);

      const list = ws || [];
      setItems(list);
      await loadFiles(list);
      await loadDatasets(list);
      setLoading(false);
    }
    init();
  }, []);

  // -------- files --------
  async function loadFiles(wsList) {
    const map = {};
    for (const w of wsList || []) {
      const { data: files } = await supabase
        .from('files').select('*')
        .eq('workspace_id', w.id)
        .order('created_at', { ascending: false });
      map[w.id] = files || [];
    }
    setFileMap(map);
  }

  async function refreshWorkspaceFiles(w) {
    const { data: files } = await supabase
      .from('files').select('*')
      .eq('workspace_id', w.id)
      .order('created_at', { ascending: false });
    setFileMap(prev => ({ ...prev, [w.id]: files || [] }));
  }

  // -------- datasets --------
  async function loadDatasets(wsList) {
    const map = {};
    for (const w of wsList || []) {
      const { data: rows, error } = await supabase
        .from('datasets').select('*')
        .eq('workspace_id', w.id)
        .order('created_at', { ascending: false });
      if (error) console.error(error);
      map[w.id] = rows || [];
    }
    setDatasetMap(map);
  }

  async function refreshWorkspaceDatasets(w) {
    const { data: rows } = await supabase
      .from('datasets').select('*')
      .eq('workspace_id', w.id)
      .order('created_at', { ascending: false });
    setDatasetMap(prev => ({ ...prev, [w.id]: rows || [] }));
  }

  async function downloadDataset(row) {
    try {
      const { data, error } = await supabase
        .storage.from('datasets')
        .createSignedUrl(row.storage_path, 60);
      if (error) { setErr(error.message); return; }
      window.open(data.signedUrl, '_blank');
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  // -------- workspaces --------
  async function createWorkspace() {
    try {
      setErr(''); setOk('');
      const name = prompt('Nombre del workspace'); if (!name) return;
      const { data: w, error: e1 } = await supabase
        .from('workspaces').insert({ name, owner_user_id: user?.id || '' })
        .select().single();
      if (e1) { setErr(e1.message); return; }
      await supabase.from('members')
        .insert({ workspace_id: w.id, user_id: user.id, role: 'owner' });
      const { data: ws } = await supabase
        .from('workspaces').select('*').order('created_at', { ascending: false });
      setItems(ws || []);
      await loadFiles(ws || []);
      await loadDatasets(ws || []);
      setOk('Workspace creado');
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  // -------- preview & metadata --------
  async function savePreview(fileId, sheet, columns, rows) {
    const previewRows = rows.slice(0, 50);
    await supabase.from('file_previews').insert({
      file_id: fileId, sheet, columns, rows: previewRows
    });
    setPreviewMap(prev => ({ ...prev, [fileId]: { columns, rows: previewRows } }));
  }

  async function processLocally(file, fileRow) {
    try {
      const name = file.name.toLowerCase();
      let meta = { type: 'unknown' };

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const { sheets, header, rows } = parseExcelArrayBuffer(data);
        meta = {
          type: 'excel',
          sheets,
          first_sheet: sheets[0],
          columns: header,
          rows_count: rows.length
        };
        await savePreview(fileRow.id, sheets[0], header, rows);
      } else if (name.endsWith('.csv')) {
        const text = await file.text();
        const { header, rows } = parseCsvText(text);
        meta = { type: 'csv', columns: header, rows_count: rows.length };
        await savePreview(fileRow.id, 'csv', header, rows);
      }

      const { error } = await supabase.from('files')
        .update({ status: 'processed', processed_at: new Date().toISOString(), meta })
        .eq('id', fileRow.id);
      if (error) throw error;

      setOk('Archivo procesado');
      const w = items.find(x => x.id === fileRow.workspace_id);
      if (w) await refreshWorkspaceFiles(w);
    } catch (e) {
      setErr('Procesado local falló: ' + (e?.message || e));
    }
  }

  async function togglePreview(f) {
    if (previewMap[f.id]) {
      setPreviewMap(prev => { const p = { ...prev }; delete p[f.id]; return p; });
      return;
    }
    const { data: pv } = await supabase
      .from('file_previews')
      .select('*')
      .eq('file_id', f.id)
      .maybeSingle();
    if (pv) setPreviewMap(prev => ({ ...prev, [f.id]: { columns: pv.columns || [], rows: pv.rows || [] } }));
    else setOk('No hay preview guardada para este archivo');
  }

  // -------- upload & download --------
  async function onUpload(w, file) {
    try {
      setErr(''); setOk(''); if (!file) return;
      const allowed = ['xlsx','xls','csv'];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!allowed.includes(ext)) { setErr('Solo .xlsx, .xls o .csv'); return; }

      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `raw/${user.id}/${w.id}/${ts}-${safeName}`;

      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: false });
      if (upErr) { setErr(`Error subiendo archivo: ${upErr.message}`); return; }

      const hash = await sha256Hex(file);
      const { data: inserted, error: dbErr } = await supabase.from('files').insert({
        workspace_id: w.id,
        filename: file.name,
        storage_path: path,
        bytes: file.size,
        sha256: hash,
        status: 'uploaded'
      }).select().single();
      if (dbErr) { setErr(`Subido pero NO registrado en DB: ${dbErr.message}`); return; }

      setOk('Archivo subido y registrado correctamente');
      await refreshWorkspaceFiles(w);
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

  // -------- ingest (dataset) --------
  async function ingestFile(f) {
    try {
      setErr(''); setOk('Ingeriendo…');
      const r = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: f.id,
          workspace_id: f.workspace_id,
          storage_path: f.storage_path,
          filename: f.filename
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'ingest failed');
      setOk('Ingesta completada');
      const w = items.find(x => x.id === f.workspace_id);
      if (w) {
        await refreshWorkspaceFiles(w);
        await refreshWorkspaceDatasets(w);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  // -------- UI --------
  return (
    <div>
      <h1>Workspaces</h1>
      <div className="row" style={{ marginTop: 12, marginBottom: 12 }}>
        <button onClick={createWorkspace}>Crear workspace</button>
        <button className="secondary" onClick={signOut}>Salir</button>
      </div>

      {err && <div className="err">{err}</div>}
      {ok && <div style={{ color: '#7bffb7' }}>{ok}</div>}

      {loading ? <div>Cargando...</div> : (
        <ul className="list">
          {(items || []).map(w => (
            <li key={w.id} className="card">
              <strong>{w.name}</strong><br />
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
              <ul className="list" style={{ marginLeft: 0 }}>
                {(fileMap[w.id] || []).map(f => (
                  <li key={f.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div><strong>{f.filename}</strong></div>
                        <small>{fmtBytes(f.bytes)} · {f.status}</small><br />
                        {f.meta && (
                          <small>
                            {f.meta.type === 'excel' && `Hojas: ${(f.meta.sheets && f.meta.sheets.length ? f.meta.sheets.join(', ') : f.meta.first_sheet || '-') } · Filas: ${f.meta.rows_count}`}
                            {f.meta.type === 'csv' && `CSV · Columnas: ${(f.meta.columns || []).length} · Filas: ${f.meta.rows_count}`}
                          </small>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="secondary" onClick={() => togglePreview(f)}>
                          {previewMap[f.id] ? 'Ocultar preview' : 'Ver preview'}
                        </button>
                        <button className="secondary" onClick={() => downloadFile(f)}>Descargar</button>
                        <button
                          className="secondary"
                          onClick={() => ingestFile(f)}
                          disabled={f.status === 'ingested' || f.status === 'ingesting' || f.status === 'uploaded'}
                          title={f.status === 'ingested'
                            ? 'Ya ingerido'
                            : (f.status === 'uploaded' ? 'Primero procesa el archivo' : 'Convertir a dataset')}
                        >
                          {f.status === 'ingested' ? 'Ingerido' : 'Ingerir a dataset'}
                        </button>
                      </div>
                    </div>

                    {previewMap[f.id] && (
                      <div style={{ overflowX: 'auto', marginTop: 8 }}>
                        <table>
                          <thead>
                            <tr>
                              {(previewMap[f.id].columns || []).map((c, i) => (
                                <th key={i} style={{ textAlign: 'left', padding: '4px 8px' }}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(previewMap[f.id].rows || []).map((r, ri) => (
                              <tr key={ri}>
                                {(previewMap[f.id].columns || []).map((_, ci) => (
                                  <td key={ci} style={{ padding: '4px 8px', borderTop: '1px solid #333' }}>
                                    {r?.[ci] ?? ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                ))}
                {(!fileMap[w.id] || fileMap[w.id].length === 0) && (
                  <li className="card">Aún no hay archivos.</li>
                )}
              </ul>

              <div className="spc" />
              <div><em>Datasets</em></div>
              <ul className="list" style={{ marginLeft: 0 }}>
                {(datasetMap[w.id] || []).map(d => (
                  <li key={d.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <div>
                      <div><strong>{d.filename}</strong></div>
                      <small>{d.storage_path}</small><br/>
                      <small>Filas: {d.rows_count ?? '-'}</small>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="secondary" onClick={() => downloadDataset(d)}>Descargar CSV</button>
                    </div>
                  </li>
                ))}
                {(!datasetMap[w.id] || datasetMap[w.id].length === 0) && (
                  <li className="card">Aún no hay datasets.</li>
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
'use client';

import AuthGuard from '../components/AuthGuard';

export default function WorkspacesPage() {
  return (
    <AuthGuard>
      <main style={{ maxWidth: 980, margin: '40px auto', padding: '0 16px' }}>
        <section
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px 0' }}>Workspaces</h2>
          <p style={{ opacity: 0.8, margin: 0 }}>
            Administra aquí tus archivos y datasets. (Si ya tenías una UI más avanzada, puedes
            reemplazar este contenido sin tocar el guard.)
          </p>
        </section>
      </main>
    </AuthGuard>
  );
}
