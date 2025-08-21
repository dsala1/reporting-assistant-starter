'use client';
import { supabase } from '../lib/supabaseClient';
import { LoginForm } from '../components/AuthForm'; // o SignupForm


export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) router.push('/workspaces');
      else setChecking(false);
    });
  }, [router]);
  if (checking) return <div>...</div>;
  return <LoginForm />;
}
