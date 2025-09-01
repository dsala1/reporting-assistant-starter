'use client';
import AuthGuard from '../components/AuthGuard';

export default function WorkspacesLayout({ children }) {
  // Este layout envuelve TODO lo que hay bajo /workspaces (incluyendo tu page.js enorme)
  return <AuthGuard>{children}</AuthGuard>;
}
