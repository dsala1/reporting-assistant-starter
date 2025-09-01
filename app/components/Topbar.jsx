// app/components/Topbar.jsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Topbar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserEmail(data.session?.user?.email ?? null);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    loadSession();
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <header className="topbar">
      <div className="topbar-inner container">
        <div className="brand">
          <Link href="/chat">Reporting Assistant</Link>
        </div>

        <nav className="nav">
          <Link href="/chat">Chat</Link>
          <Link href="/playbook">Playbook</Link>
        </nav>

        <div className="actions">
          {userEmail ? (
            <>
              <span className="muted email">{userEmail}</span>
              <button className="btn" onClick={handleLogout}>Salir</button>
            </>
          ) : (
            <>
              <Link className="btn ghost" href="/login">Entrar</Link>
              <Link className="btn" href="/signup">Registro</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
