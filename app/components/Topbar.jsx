'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Topbar() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession ?? null);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="ra-topbar">
      <div className="ra-topbar__inner">
        <Link href="/chat" className="ra-brand">Reporting Assistant</Link>

        <nav className="ra-nav">
          <Link href="/chat" className="ra-nav__link">Chat</Link>
          <Link href="/playbook" className="ra-nav__link">Playbook</Link>
          {/* Workspaces oculto del menú: no lo renderizamos */}
        </nav>

        <div className="ra-actions">
          {!session ? (
            <>
              <Link href="/login" className="ra-btn ra-btn--ghost">Entrar</Link>
              {/* No mostramos Registro aquí; estará en /login */}
            </>
          ) : (
            <button onClick={handleLogout} className="ra-btn">Salir</button>
          )}
        </div>
      </div>
    </header>
  );
}
