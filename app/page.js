'use client';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function WorkspacesPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      if (!u) {
        window.location.href = '/login';
        return;
      }
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
    setErr('');
    const name = prompt('Nombre del workspace');
    if (!name) return;
    // 1) Crear workspace con owner = usuario actual
    const { data: w, error: e1 } = await supabase
      .from('workspaces')
      .insert({ name, owner_user_id: user.id })
      .select()
      .single();
    if (e1) { setErr(e1.message); return; }
    // 2) Añadir miembro (owner)
    const { error: e2 } = await supabase
      .from('members')
      .insert({ workspace_id: w.id, user_id: user.id, role: 'owner' });
    if (e2) { setErr(e2.message); return; }
    // refrescar lista
    const { data: ws } = await supabase
      .from('workspaces').select('*').order('created_at', { ascending: false });
    setItems(ws || []);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <div>
      <h1>Workspaces</h1>
      <div className="spc" />
      <div className="row">
        <button onClick={createWorkspace}>Crear workspace</button>
        <button className="secondary" onClick={signOut}>Salir</button>
      </div>
      <div className="spc" />
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
