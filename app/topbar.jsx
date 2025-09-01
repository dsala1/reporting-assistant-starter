'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import './topbar.css';

/**
 * Topbar minimal con logo + navegación “Chat / Playbook / Salir”
 * Ajusta la acción de "Salir" a tu flujo real (Supabase u otro).
 */
export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (p) => pathname === p;

  // Si usas Supabase en el cliente, puedes importar tu client y signOut aquí.
  // Como placeholder, redirigimos a /logout (si existe) o a /login.
  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) router.push('/login');
      else router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__inner">
        {/* Brand (click → chat) */}
        <Link href="/chat" className="brand" aria-label="Ir a inicio">
          <span className="brand__logo" aria-hidden="true">
            <Image
              src="/logo.svg"
              width={28}
              height={28}
              alt=""
              priority
            />
          </span>
          <span className="brand__name">Reporting Assistant</span>
        </Link>

        {/* Navegación principal */}
        <nav className="nav" aria-label="Navegación principal">
          <Link href="/chat" className={isActive('/chat') ? 'active' : ''}>
            Chat
          </Link>
          <Link href="/playbook" className={isActive('/playbook') ? 'active' : ''}>
            Playbook
          </Link>
        </nav>

        {/* Acciones (logout) */}
        <div className="actions">
          <a href="/logout" onClick={handleLogout} className="btn-logout">Salir</a>
        </div>
      </div>
    </header>
  );
}
