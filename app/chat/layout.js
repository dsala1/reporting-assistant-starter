'use client';
import AuthGuard from '../components/AuthGuard';

export default function ChatLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
