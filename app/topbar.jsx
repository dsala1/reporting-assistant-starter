'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './topbar.css';

export default function Topbar() {
  const pathname = usePathname();

  const NavLink = ({ href, children }) => {
    const active = pathname?.startsWith(href);
    return (
      <Link href={href} className={`topbar-link ${active ? 'active' : ''}`}>
        {children}
      </Link>
    );
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/chat" className="brand">
          Reporting Assistant
        </Link>

        <nav className="nav">
          <NavLink href="/chat">Chat</NavLink>
          <NavLink href="/playbook">Playbook</NavLink>
          <Link href="/logout" className="signout">Salir</Link>
        </nav>
      </div>
    </header>
  );
}
