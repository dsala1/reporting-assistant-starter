'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [user,setUser] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  useEffect(()=>{
    let ignore=false;
    (async()=>{
      const { data } = await supabase.auth.getSession();
      if(!ignore){
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user ?? null));
    return ()=>sub?.subscription?.unsubscribe();
  },[]);

  const signIn = async (e)=>{
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else window.location.href = '/chat';
  };

  const signUp = async (e)=>{
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else window.location.href = '/chat';
  };

  if (loading) return null;

  if (user) {
    return (
      <div className="container">
        <div className="card" style={{maxWidth:420, margin:'40px auto'}}>
          <h2 style={{marginBottom:12}}>Ya has iniciado sesión</h2>
          <p className="help" style={{marginBottom:16}}>Puedes ir directamente al chat.</p>
          <Link href="/chat" className="btn">Ir al chat</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <form className="card" style={{maxWidth:420, margin:'40px auto'}} onSubmit={signIn}>
        <h2 style={{marginBottom:12}}>Entrar</h2>
        <p className="help" style={{marginBottom:16}}>Usa tu email y contraseña.</p>

        <label className="help">Email</label>
        <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{margin:'6px 0 12px'}} />

        <label className="help">Contraseña</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={{margin:'6px 0 16px'}} />

        {error && <p className="help" style={{color:'#ffb4b4', marginBottom:10}}>{error}</p>}

        <div style={{display:'flex', gap:10}}>
          <button className="btn" type="submit">Entrar</button>
          <button className="btn-ghost" type="button" onClick={signUp}>Crear cuenta</button>
        </div>
      </form>
    </div>
  );
}
