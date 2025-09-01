'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // Cierra sesión en el cliente (borra session/localStorage)
        await supabase.auth.signOut();
      } catch (e) {
        // opcional: console.error(e);
      } finally {
        // Redirige a donde prefieras tras cerrar sesión
        router.replace('/chat'); // o '/login' si tienes esa página
      }
    })();
  }, [router]);

  return (
    <div style={{ maxWidth: 700, margin: '56px auto', textAlign: 'center', color: '#a9b1c6' }}>
      Cerrando sesión…
    </div>
  );
}
