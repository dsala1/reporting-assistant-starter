'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Topbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!ignore) setUser(data.session?.user ?? null);
    }
    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      ignore = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Volvemos al chat (pública) o a /login si quieres
    window.location.href = '/chat';
  };

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link href="/chat" className="brand" prefetch={false}>
          Reporting Assistant
        </Link>

        <nav className="nav">
          <Link href="/chat" prefetch={false}>Chat</Link>
          <Link href="/playbook" prefetch={false}>Playbook</Link>

          {user ? (
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              Salir
            </button>
          ) : (
            <Link href="/login" prefetch={false} className="btn-ghost">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
