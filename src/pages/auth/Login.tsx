import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { useAppStatus } from '@/store/appStatusStore';
import { Button, Input } from '@/components/ui';
import { SocialButtons } from '@/components/features';
import { useAuthStore } from '@/store/authStore';
import { BRAND } from '@/lib/site';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS, mailto } from '@/lib/emails';
import { checkEmail } from '@/lib/validate';

export default function Login() {
  const appPaused = useAppStatus()?.paused;
  useSeo({ title: 'Log in', description: `Log in to ${BRAND} to pick up your conversations where you left off.`, path: '/login', noIndex: true });
  const { signIn, error, clearError } = useAuthStore();
  useEffect(() => { clearError(); }, [clearError]);
  const nav = useNavigate();
  const loc = useLocation() as { state?: { reason?: string } };
  const notice = loc.state?.reason;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState({ email: '', password: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = { email: checkEmail(email), password: password ? '' : 'Enter your password.' };
    setProblems(found);
    if (found.email || found.password) return;
    setBusy(true);
    if (await signIn(email.trim(), password)) nav('/home');
    setBusy(false);
  };

  return (
    <AuthLayout title="Welcome back">
      {appPaused && <p role="status" className="mb-3 text-sm">The Fluency Talks is paused for a short while. Staff can still log in.</p>}
      <div className="space-y-6">
        <p className="-mt-2 text-center text-sm text-muted">
          Log in to pick up your conversations where you left off.
        </p>
        {notice && (
          <p role="status" className="rounded-md border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-medium">
            {notice}
          </p>
        )}

        <form noValidate onSubmit={submit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            error={problems.email}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setProblems((p) => ({ ...p, email: '' })); }}
          />
          <div className="space-y-2">
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              error={problems.password}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setProblems((p) => ({ ...p, password: '' })); }}
            />
            <div className="text-right">
              <Link
                className="text-sm font-semibold text-brand hover:text-accent"
                to="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
            >
              {error}
            </p>
          )}

          <Button type="submit" full loading={busy}>
            Log in
          </Button>
        </form>
        <div className="flex w-full h-14 items-center my-4">
          <div className="h-px flex-1 border border-0.5 border-ink/20"></div>
          <span className="px-4 text-sm font-semibold text-ink uppercase tracking-wider">
            OR
          </span>
          <div className="h-px border border-0.5 border-ink/20 flex-1 "></div>
        </div>
        <SocialButtons />

        <p className="text-center text-sm text-muted">
          New to {BRAND}?{' '}
          <Link className="font-bold text-brand hover:text-accent" to="/signup">
            Create a free account
          </Link>
        </p>
        <p className="text-center text-sm text-muted">
          Trouble logging in? Email <a className="font-semibold text-brand hover:text-accent" href={mailto(EMAILS.support, { subject: 'Login help' })}>{EMAILS.support}</a>
        </p>
      </div>
    </AuthLayout>
  );
}
