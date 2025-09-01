// app/login/page.js
import LoginForm from './LoginForm';

export default function LoginPage() {
  // Si no necesitas redirigir con ?next=... todavía, fija /chat
  return <LoginForm next="/chat" />;
}
