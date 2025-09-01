// components/Topbar.jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function Topbar() {
  const [isAuthed, setIsAuthed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    let mounted = true;

    // 1) Estado inicial
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(Boolean(data.session));
    });

    // 2) Reaccionar a cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const linkCls = (href) =>
    `px-3 py-1 rounded-md text-sm ${
      pathname === href ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:text-white'
    }`;

  return (
    <header className="w-full border-b border-zinc-800 bg-[#0A0F1A]/80 sticky top-0 z-40 backdrop-blur">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        {/* Marca (texto simple; si quieres el logo de nuevo, aquí) */}
        <Link href="/chat" className="font-semibold text-zinc-100">
          Reporting Assistant
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/chat" className={linkCls('/chat')}>Chat</Link>
          <Link href="/playbook" className={linkCls('/playbook')}>Playbook</Link>

          {/* Lado derecho: Entrar / Salir */}
          {isAuthed ? (
            <button
              className="ml-3 px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500"
              onClick={() => router.push('/logout')}
            >
              Salir
            </button>
          ) : (
            <button
              className="ml-3 px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500"
              onClick={() => router.push('/login')}
            >
              Entrar
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
