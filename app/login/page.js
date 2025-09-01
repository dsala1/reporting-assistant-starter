'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = sp.get('next') || '/chat';

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password: pw,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    if (data?.session) router.replace(next);
  }

  return (
    <div style={{display:'grid',placeItems:'center',minHeight:'60vh'}}>
      <form onSubmit={onSubmit} style={{
        width:'100%', maxWidth: 420, padding: 20, borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.04)'
      }}>
        <h1 style={{margin:'0 0 6px'}}>Entrar</h1>
        <p style={{opacity:.75, margin:'0 0 16px'}}>Accede para usar el asistente.</p>

        <label style={{display:'block', fontSize:13, opacity:.75, marginBottom:6}}>Email</label>
        <input
          type="email" value={email} onChange={e=>setEmail(e.target.value)}
          required
          style={{width:'100%', padding:'10px 12px', borderRadius:10,
                  border:'1px solid rgba(255,255,255,0.16)', background:'transparent',
                  color:'inherit', marginBottom:12}}
        />

        <label style={{display:'block', fontSize:13, opacity:.75, marginBottom:6}}>Contraseña</label>
        <input
          type="password" value={pw} onChange={e=>setPw(e.target.value)}
          required
          style={{width:'100%', padding:'10px 12px', borderRadius:10,
                  border:'1px solid rgba(255,255,255,0.16)', background:'transparent',
                  color:'inherit', marginBottom:16}}
        />

        {err && <div style={{color:'#ef4444', fontSize:13, marginBottom:10}}>{err}</div>}

        <button disabled={loading} className="ra-btn" style={{width:'100%'}}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div style={{marginTop:12, fontSize:13, opacity:.8}}>
          ¿No tienes cuenta?{' '}
          <Link href="/signup" style={{textDecoration:'underline'}}>Regístrate</Link>
        </div>
      </form>
    </div>
  );
}
