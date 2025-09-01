// app/login/page.js
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Entrar | Reporting Assistant',
};

export default function Page({ searchParams }) {
  const next = typeof searchParams?.next === 'string' ? searchParams.next : '/chat';
  return <LoginForm next={next} />;
}
