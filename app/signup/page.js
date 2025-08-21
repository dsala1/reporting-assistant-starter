'use client';
import { supabase } from '../lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) router.push('/workspaces');
      else setChecking(false);
    });
  }, [router]);
  if (checking) return <div>...</div>;
  return <SignupForm />;
}
