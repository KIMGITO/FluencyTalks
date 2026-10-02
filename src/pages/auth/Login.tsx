import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { SocialButtons } from '@/components/features';
import { useAuthStore } from '@/store/authStore';

export default function Login() {
  const { signIn, error } = useAuthStore();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (await signIn(email, password)) nav('/home');
    setBusy(false);
  };

  return (
    <AuthLayout title="Welcome back">
      <div className="space-y-6">
        <p className="-mt-2 text-center text-sm text-muted">
          Log in to pick up your conversations where you left off.
        </p>

        <SocialButtons />

        <div className="flex items-center gap-3 text-xs font-semibold text-muted">
          <span className="h-px flex-1 bg-border" />
          or log in with email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-2">
            <Input
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

        <p className="text-center text-sm text-muted">
          New to FluencyTalks?{' '}
          <Link className="font-bold text-brand hover:text-accent" to="/signup">
            Create a free account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
