import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input, Spinner } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useSeo } from '@/hooks/useSeo';

/**
 * Opened from the link in the password-reset email. Three outcomes:
 *  - the link works: a recovery session exists, so show the form;
 *  - the link is expired or already used (Supabase says so in the URL) or there is no session: say so
 *    and point to a new request, instead of showing a form that can only fail;
 *  - the password is saved: confirm, then go to the app.
 */
export default function ResetPassword() {
  useSeo({ title: 'Choose a new password', description: 'Choose a new password for your The Fluency Talks account.', path: '/reset-password', noIndex: true });
  const { updatePassword, clearError, error, session, loading, recoveryLinkError } = useAuthStore();
  const nav = useNavigate();
  const [pw, setPw] = useState(''); const [again, setAgain] = useState('');
  const [problem, setProblem] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { clearError(); }, [clearError]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setProblem('');
    if (pw !== again) { setProblem('The two passwords do not match.'); return; }
    setBusy(true);
    const ok = await updatePassword(pw);
    setBusy(false);
    if (ok) { setDone(true); window.setTimeout(() => nav('/home', { replace: true }), 1200); }
  };

  if (loading) return <AuthLayout title="Choose a new password"><div className="flex justify-center py-6"><Spinner /></div></AuthLayout>;

  if (recoveryLinkError || !session) {
    return (
      <AuthLayout title="Link expired">
        <p className="text-sm text-muted">This reset link has expired or was already used. Links work once and last one hour.</p>
        <Link to="/forgot-password"><Button full>Request a new link</Button></Link>
        <Link className="text-sm text-brand" to="/login">Back to log in</Link>
      </AuthLayout>
    );
  }
  if (done) return <AuthLayout title="Password updated"><p className="text-sm text-muted">You are signed in. Taking you to your account…</p></AuthLayout>;

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="space-y-3">
        <Input id="pw" type="password" label="New password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
        <Input id="pw2" type="password" label="Repeat password" autoComplete="new-password" minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} required />
        <p className="text-xs text-muted">At least 8 characters.</p>
        {(problem || error) && <p className="text-sm text-danger">{problem || error}</p>}
        <Button type="submit" full loading={busy}>Save password</Button>
      </form>
    </AuthLayout>
  );
}
