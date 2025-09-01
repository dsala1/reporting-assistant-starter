// app/page.js
import { redirect } from 'next/navigation';

export default function Home() {
  // Entrada obligatoria por login. Luego la app te lleva al chat.
  redirect('/login?next=/chat');
}
