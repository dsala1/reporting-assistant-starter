'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/** Supabase browser client */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/** Opciones auxiliares */
const WINDOW_OPTIONS = [
  { value: 'intra-day', label: 'Intra-día' },
  { value: 'daily',     label: 'Diario'   },
  { value: 'weekly',    label: 'Semanal'  },
  { value: 'monthly',   label: 'Mensual'  },
];
const OPS = ['<','>','<=','>=','between'];
const SEVERITIES = [
  { value: 'info',  label: 'Info'  },
  { value: 'warn',  label: 'Aviso' },
  { value: 'crit',  label: 'Crítico' },
];

export default function PlaybookPage() {
  const [user, setUser] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);

  // tabs
  const [tab, setTab] = useState('business'); // business | rules | alerts

  // business
  const [summary, setSummary] = useState('');
  const [goalsText, setGoalsText]   = useState('');  // textarea → JSON
  const [marketsText, setMarketsText] = useState('');

  // rules
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  // alerts
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // feedback
  const [toast, setToast] = useState(null); // {type:'ok'|'err', msg:''}

  /** helper toast */
  const show = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  /** get user & workspace (si lo pasas por query ?ws=) */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user || null);

      const params = new URLSearchParams(window.location.search);
      const ws = params.get('ws');
      setWorkspaceId(ws || null);
    })();
  }, []);

  /** cargar datos de playbook al entrar */
  useEffect(() => {
    if (!user) return;
    loadBusiness();
    loadRules();
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId]);

  async function loadBusiness() {
    // business para user + (workspaceId || null)
    let q = supabase
      .from('playbook_business')
      .select('id, summary, goals, markets')
      .eq('user_id', user.id);

    if (workspaceId) q = q.eq('workspace_id', workspaceId);
    else             q = q.is('workspace_id', null);

    const { data, error } = await q.maybeSingle();
    if (error && error.code !== 'PGRST116') { // not found is fine
      console.error(error);
      show('err', 'Error cargando Playbook');
      return;
    }
    if (!data) {
      setSummary('');
      setGoalsText('[]');
      setMarketsText('[]');
      return;
    }
    setSummary(data.summary || '');
    setGoalsText(JSON.stringify(data.goals ?? [], null, 2));
    setMarketsText(JSON.stringify(data.markets ?? [], null, 2));
  }

  async function saveBusiness() {
    if (!user) return;

    let goals, markets;
    try {
      goals = goalsText.trim() ? JSON.parse(goalsText) : [];
      markets = marketsText.trim() ? JSON.parse(marketsText) : [];
    } catch (e) {
      show('err', 'Goals/Markets deben ser JSON válido (p.ej. ["objetivo 1","objetivo 2"])');
      return;
    }

    const payload = {
      user_id: user.id,
      workspace_id: workspaceId,
      summary,
      goals,
      markets,
    };

    const { error } = await supabase
      .from('playbook_business')
      .upsert(payload, { onConflict: 'user_id,workspace_id' });

    if (error) {
      console.error(error);
      show('err', 'No se pudo guardar el Playbook');
    } else {
      show('ok', 'Playbook guardado');
    }
  }

  async function loadRules() {
    if (!user) return;
    setLoadingRules(true);

    let q = supabase
      .from('rules')
      .select('id,name,metric,op,threshold_low,threshold_high,time_window,dimension,severity,active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (workspaceId) q = q.eq('workspace_id', workspaceId);
    else             q = q.is('workspace_id', null);

    const { data, error } = await q;
    setLoadingRules(false);
    if (error) {
      console.error(error);
      show('err', 'Error cargando reglas');
      return;
    }
    setRules(data || []);
  }

  function addRule() {
    setRules(r => ([
      ...r,
      {
        id: null,
        name: '',
        metric: '',
        op: '<',
        threshold_low: 0,
        threshold_high: null,
        time_window: 'daily',   // <- correcto
        dimension: null,
        severity: 'info',
        active: true,
      }
    ]));
  }

  async function saveAllRules() {
    if (!user) return;
    setSavingRules(true);

    // sanea y valida
    const cleaned = [];
    for (const r of rules) {
      if (!r.name || !r.metric || !OPS.includes(r.op)) continue;
      const row = {
        id: r.id || undefined,
        user_id: user.id,
        workspace_id: workspaceId,
        name: r.name.trim(),
        metric: r.metric.trim(),
        op: r.op,
        threshold_low: Number(r.threshold_low ?? 0),
        threshold_high: r.op === 'between' ? Number(r.threshold_high ?? 0) : null,
        time_window: r.time_window || 'daily',
        dimension: r.dimension?.trim() || null,
        severity: SEVERITIES.some(s => s.value === r.severity) ? r.severity : 'info',
        active: !!r.active,
      };
      cleaned.push(row);
    }

    if (!cleaned.length) {
      setSavingRules(false);
      show('ok', 'No hay reglas válidas para guardar');
      return;
    }

    const { error } = await supabase
      .from('rules')
      .upsert(cleaned, { onConflict: 'id' });

    setSavingRules(false);
    if (error) {
      console.error(error);
      show('err', 'Error guardando reglas');
    } else {
      show('ok', 'Reglas guardadas');
      loadRules();
    }
  }

  async function deleteRule(id) {
    if (!id) {
      // si es nueva, solo la quito del array
      setRules(rs => rs.filter(r => r.id));
      return;
    }
    const { error } = await supabase.from('rules').delete().eq('id', id);
    if (error) {
      console.error(error);
      show('err', 'No se pudo eliminar la regla');
    } else {
      setRules(rs => rs.filter(r => r.id !== id));
      show('ok', 'Regla eliminada');
    }
  }

  async function loadAlerts() {
    if (!user) return;
    setLoadingAlerts(true);

    let q = supabase
      .from('alerts')
      .select('id, rule_id, fired_at, status, payload')
      .eq('user_id', user.id)
      .order('fired_at', { ascending: false })
      .limit(50);

    if (workspaceId) q = q.eq('workspace_id', workspaceId);
    else             q = q.is('workspace_id', null);

    const { data, error } = await q;
    setLoadingAlerts(false);
    if (error) {
      console.error(error);
      show('err', 'Error cargando alertas');
      return;
    }
    setAlerts(data || []);
  }

  async function setAlertStatus(id, status) {
    const { error } = await supabase.from('alerts').update({ status }).eq('id', id);
    if (error) {
      console.error(error);
      show('err', 'No se pudo actualizar la alerta');
    } else {
      setAlerts(a => a.map(x => x.id === id ? { ...x, status } : x));
    }
  }

  const header = useMemo(() => (
    <div className="pb-header">
      <div className="pb-brand">Reporting Assistant</div>
      <nav className="pb-nav">
        <a className={`pb-link ${tab==='business'?'active':''}`} onClick={() => setTab('business')}>Playbook</a>
        <a className={`pb-link ${tab==='rules'?'active':''}`} onClick={() => setTab('rules')}>Reglas KPI</a>
        <a className={`pb-link ${tab==='alerts'?'active':''}`} onClick={() => setTab('alerts')}>Alertas</a>
      </nav>
    </div>
  ), [tab]);

  return (
    <div className="pb-wrapper">

      {header}

      <main className="pb-main">
        {tab === 'business' && (
          <section className="pb-card">
            <h2>Playbook</h2>
            <p className="pb-muted">
              Define el contexto para personalizar el análisis (qué te importa, objetivos, mercados).
            </p>

            <div className="pb-field">
              <label>Resumen / Contexto</label>
              <textarea className="pb-input" rows={4} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Qué es importante para ti, cómo medir éxito, restricciones, etc." />
            </div>

            <div className="pb-grid">
              <div className="pb-field">
                <label>Objetivos (JSON)</label>
                <textarea className="pb-input" rows={8} value={goalsText} onChange={e=>setGoalsText(e.target.value)} placeholder='["Incrementar profit", "Reducir churn"]' />
              </div>
              <div className="pb-field">
                <label>Mercados / Segmentos (JSON)</label>
                <textarea className="pb-input" rows={8} value={marketsText} onChange={e=>setMarketsText(e.target.value)} placeholder='["ES","MX","CL"]' />
              </div>
            </div>

            <div className="pb-actions">
              <button className="pb-btn primary" onClick={saveBusiness}>Guardar Playbook</button>
            </div>
          </section>
        )}

        {tab === 'rules' && (
          <section className="pb-card">
            <h2>Reglas KPI</h2>
            <p className="pb-muted">
              Define umbrales (márgenes, ingresos, ratios…) y períodos. Generaremos alertas si se incumplen.
            </p>

            <div className="pb-actions">
              <button className="pb-btn" onClick={addRule}>+ Añadir regla</button>
              <button className="pb-btn primary" onClick={saveAllRules} disabled={savingRules}>
                {savingRules ? 'Guardando…' : 'Guardar reglas'}
              </button>
            </div>

            {loadingRules ? <div className="pb-skeleton">Cargando…</div> : (
              <div className="pb-table">
                <div className="pb-thead">
                  <div>Nombre</div>
                  <div>Métrica</div>
                  <div>Operador</div>
                  <div>Umbral</div>
                  <div>Ventana</div>
                  <div>Dimensión</div>
                  <div>Severidad</div>
                  <div>Activa</div>
                  <div></div>
                </div>

                {rules.map((r, i) => (
                  <div className="pb-row" key={r.id ?? `new-${i}`}>
                    <div><input className="pb-input" value={r.name} onChange={e=>{ const v=[...rules]; v[i].name=e.target.value; setRules(v); }} placeholder="Nombre" /></div>
                    <div><input className="pb-input" value={r.metric} onChange={e=>{ const v=[...rules]; v[i].metric=e.target.value; setRules(v); }} placeholder="p.ej. profit_eur" /></div>
                    <div>
                      <select className="pb-input" value={r.op} onChange={e=>{ const v=[...rules]; v[i].op=e.target.value; setRules(v); }}>
                        {OPS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </div>
                    <div className="pb-threshold">
                      <input className="pb-input" type="number" value={r.threshold_low ?? 0} onChange={e=>{ const v=[...rules]; v[i].threshold_low=e.target.value; setRules(v); }} />
                      {r.op === 'between' && (
                        <input className="pb-input" type="number" value={r.threshold_high ?? 0} onChange={e=>{ const v=[...rules]; v[i].threshold_high=e.target.value; setRules(v); }} />
                      )}
                    </div>
                    <div>
                      <select className="pb-input" value={r.time_window} onChange={e=>{ const v=[...rules]; v[i].time_window=e.target.value; setRules(v); }}>
                        {WINDOW_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                      </select>
                    </div>
                    <div><input className="pb-input" value={r.dimension ?? ''} onChange={e=>{ const v=[...rules]; v[i].dimension=e.target.value; setRules(v); }} placeholder="opcional" /></div>
                    <div>
                      <select className="pb-input" value={r.severity} onChange={e=>{ const v=[...rules]; v[i].severity=e.target.value; setRules(v); }}>
                        {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div><input type="checkbox" checked={!!r.active} onChange={e=>{ const v=[...rules]; v[i].active=e.target.checked; setRules(v); }} /></div>
                    <div><button className="pb-btn danger" onClick={()=>deleteRule(r.id)}>Eliminar</button></div>
                  </div>
                ))}

                {!rules.length && <div className="pb-empty">Sin reglas todavía.</div>}
              </div>
            )}
          </section>
        )}

        {tab === 'alerts' && (
          <section className="pb-card">
            <h2>Alertas</h2>
            <p className="pb-muted">Últimas alertas disparadas por tus reglas.</p>

            <div className="pb-actions">
              <button className="pb-btn" onClick={loadAlerts} disabled={loadingAlerts}>
                {loadingAlerts ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>

            <div className="pb-list">
              {alerts.map(a => (
                <div className="pb-alert" key={a.id}>
                  <div className="pb-alert-top">
                    <span className={`badge ${a.status}`}>{a.status}</span>
                    <span className="time">{new Date(a.fired_at).toLocaleString()}</span>
                  </div>
                  <pre className="pb-code">{JSON.stringify(a.payload, null, 2)}</pre>
                  <div className="pb-actions">
                    {a.status !== 'read' && <button className="pb-btn" onClick={()=>setAlertStatus(a.id,'read')}>Marcar como leído</button>}
                    {a.status !== 'dismissed' && <button className="pb-btn" onClick={()=>setAlertStatus(a.id,'dismissed')}>Descartar</button>}
                  </div>
                </div>
              ))}
              {!alerts.length && <div className="pb-empty">Sin alertas aún.</div>}
            </div>
          </section>
        )}
      </main>

      {!!toast && (
        <div className={`pb-toast ${toast.type}`}>{toast.msg}</div>
      )}

      <style jsx global>{`
        .pb-wrapper { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
        .pb-header { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 16px; }
        .pb-brand { font-weight: 700; letter-spacing: .3px; opacity:.9 }
        .pb-nav { display: flex; gap: 12px; }
        .pb-link { cursor: pointer; opacity: .7; padding: 6px 10px; border-radius: 8px; }
        .pb-link.active, .pb-link:hover { background: rgba(255,255,255,0.06); opacity:1; }

        .pb-main { display: grid; gap: 16px; }
        .pb-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; }
        .pb-muted { opacity: .75; margin-top: 4px; }

        .pb-field { display: grid; gap: 8px; margin: 12px 0; }
        .pb-grid { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) { .pb-grid { grid-template-columns: 1fr; } }

        .pb-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 12px; color: inherit; }
        .pb-input:focus { outline: none; border-color: rgba(99,102,241,.7); box-shadow: 0 0 0 3px rgba(99,102,241,.15); }

        .pb-actions { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
        .pb-btn { padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
        .pb-btn:hover { background: rgba(255,255,255,0.10); }
        .pb-btn.primary { background: #3b82f6; border-color: #3b82f6; color: white; }
        .pb-btn.danger { background: #ef4444; border-color: #ef4444; color: white; }

        .pb-table { display: grid; gap: 8px; margin-top: 12px; }
        .pb-thead, .pb-row { display: grid; grid-template-columns: 1.2fr 1.2fr .8fr 1.2fr 1fr 1fr 1fr .6fr .6fr; gap: 8px; align-items: center; }
        .pb-thead { font-size: 13px; opacity: .7; }
        .pb-threshold { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .pb-empty { opacity:.7; padding: 12px; }

        .pb-list { display: grid; gap: 12px; }
        .pb-alert { border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.04); }
        .pb-alert-top { display:flex; gap:8px; align-items:center; justify-content: space-between; margin-bottom: 8px; }
        .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: rgba(255,255,255,0.1); }
        .badge.read { background: #22c55e33; }
        .badge.dismissed { background: #f59e0b33; }
        .time { opacity:.7; font-size: 12px; }
        .pb-code { background: rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.07); padding:8px; border-radius:8px; max-height: 220px; overflow:auto; }

        .pb-skeleton { opacity:.7; }

        .pb-toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,.7); border:1px solid rgba(255,255,255,.15); padding:10px 14px; border-radius: 10px; }
        .pb-toast.ok { background: #16a34a; border-color: #16a34a; color:white; }
        .pb-toast.err { background: #dc2626; border-color: #dc2626; color:white; }
      `}</style>
    </div>
  );
}
