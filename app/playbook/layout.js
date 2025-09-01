'use client';
import AuthGuard from '../components/AuthGuard';

export default function PlaybookLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
