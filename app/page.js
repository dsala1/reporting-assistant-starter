// app/page.js
import { redirect } from 'next/navigation';

export default function Home() {
  // Portada -> /chat
  redirect('/chat');
}
