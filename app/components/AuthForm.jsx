'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    else router.push('/workspaces');
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Entrar</h2>
      <div className="spc" />
      <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <div className="spc" />
      <input placeholder="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
      <div className="spc" />
      {err && <div className="err">{err}</div>}
      <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    else {
      setMsg('Cuenta creada. Revisa tu correo para confirmar.');
      // Si tienes auto-confirm activo, puedes redirigir directamente:
      // router.push('/workspaces');
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Registro</h2>
      <div className="spc" />
      <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <div className="spc" />
      <input placeholder="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
      <div className="spc" />
      {err && <div className="err">{err}</div>}
      {msg && <div>{msg}</div>}
      <button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear cuenta'}</button>
    </form>
  );
}
