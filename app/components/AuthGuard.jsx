'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthGuard({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'blocked'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'ok' : 'blocked');
    });
  }, []);

  if (status === 'checking') {
    return (
      <div style={{
        display:'grid',placeItems:'center',minHeight:'60vh',
        opacity:.8,fontSize:14
      }}>
        Verificando sesión…
      </div>
    );
  }

  if (status === 'blocked') {
    const next = typeof window !== 'undefined'
      ? encodeURIComponent(window.location.pathname)
      : '/chat';

    return (
      <div style={{minHeight:'60vh',display:'grid',placeItems:'center',padding:'24px'}}>
        <div style={{
          maxWidth:460,width:'100%',background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.10)',borderRadius:16,padding:20
        }}>
          <h2 style={{margin:'0 0 8px 0'}}>Inicia sesión</h2>
          <p style={{opacity:.75,margin:'0 0 16px 0'}}>
            Para continuar, entra con tu cuenta.
          </p>
          <a
            href={`/login?next=${next}`}
            style={{
              display:'inline-block',padding:'10px 14px',borderRadius:10,
              background:'#3b82f6',border:'1px solid #3b82f6',color:'#fff',
              textDecoration:'none'
            }}
          >
            Entrar
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
