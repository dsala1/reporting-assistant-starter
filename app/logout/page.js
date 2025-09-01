// app/logout/page.js
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    (async () => {
      try {
        await supabase.auth.signOut();   // cierra sesión
      } catch (e) {
        // opcional: logging
      } finally {
        router.replace('/login');        // llévalo a /login (no /chat)
      }
    })();
  }, [router]);

  return null; // nada que renderizar
}
