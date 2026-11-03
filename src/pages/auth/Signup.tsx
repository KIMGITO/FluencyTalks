import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { SocialButtons } from '@/components/features';
import { useSeo } from '@/hooks/useSeo';
import { useAuthStore } from '@/store/authStore';
import { checkEmail, checkPassword } from '@/lib/validate';
export default function Signup() {
  useSeo({ title: 'Sign up', description: 'Create a free The Fluency Talks account and start practicing with native speakers today.', path: '/signup', noIndex: true });
  const { signUp, error, clearError } = useAuthStore();
  useEffect(() => { clearError(); }, [clearError]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState({ email: '', password: '' });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = { email: checkEmail(email), password: checkPassword(password) };
    setProblems(found);
    if (found.email || found.password) return;
    setBusy(true);
    setSent(await signUp(email.trim(), password));
    setBusy(false);
  };
  if (sent)
    return (
      <AuthLayout title="Check your email">
        <p className="text-muted">
          We sent a confirmation link to {email.trim()}. Open it to finish creating
          your account.
        </p>
      </AuthLayout>
    );
  return (
    <AuthLayout title="Create your account">
      <form noValidate onSubmit={submit} className="space-y-3">
        <Input
          size="sm"
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          error={problems.email}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setProblems((p) => ({ ...p, email: '' })); }}
        />
        <Input
          size="sm"
          id="password"
          type="password"
          label="Password "
          autoComplete="new-password"
          error={problems.password}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setProblems((p) => ({ ...p, password: '' })); }}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" full loading={busy}>
          Sign up
        </Button>

        <div className="flex w-full h-14 items-center my-4">
          <div className="h-px flex-1 border border-ink/20"></div>
          <span className="px-4 text-sm font-semibold text-ink uppercase tracking-wider">
            OR
          </span>
          <div className="h-px border border-ink/20 flex-1 "></div>
        </div>
        <SocialButtons />
      </form>
      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link className="text-brand" to="/login">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
