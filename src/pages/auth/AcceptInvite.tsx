import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input, Spinner } from '@/components/ui';
import { useSeo } from '@/hooks/useSeo';
import { friendlyAuthError } from '@/lib/authHelpers';
import { supabase } from '@/lib/supabase';
import { acceptAdminInvitation } from '@/services/admin';
import { useAuthStore } from '@/store/authStore';

const MIN_PASSWORD = 12;

/**
 * Opened from the invitation email, which also signs the person in. They choose a password and then log in
 * with it for real, because that login is where the QR code appears.
 */
export default function AcceptInvite() {
  useSeo({ title: 'Join the team', description: 'Accept your staff invitation for The Fluency Talks.', path: '/admin/accept-invite', noIndex: true });
  const { session, loading, signOut } = useAuthStore();
  const [params] = useSearchParams(); const nav = useNavigate();
  const [token] = useState(() => params.get('token') ?? '');
  const [pw, setPw] = useState(''); const [again, setAgain] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (token) window.history.replaceState(null, '', window.location.pathname); }, [token]);   // keep it out of history and referrers

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (pw.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (pw !== again) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await acceptAdminInvitation(token);   // first: a bad link must not change anyone's password
      const { error: pwErr } = await supabase.auth.updateUser({ password: pw });
      if (pwErr && !pwErr.message.toLowerCase().includes('different from the old')) throw new Error(friendlyAuthError(pwErr.message));
      await signOut();
      nav('/login', { replace: true, state: { reason: 'Invitation accepted. Log in with your new password, then set up Google Authenticator.' } });
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return <AuthLayout title="Join the team"><div className="flex justify-center py-6"><Spinner /></div></AuthLayout>;
  if (!token || !session) {
    return (
      <AuthLayout title="This link didn't work">
        <p className="text-sm text-muted">It may have expired or already been used. Ask the person who invited you to send a new one.</p>
        <Link className="text-sm text-brand" to="/login">Back to log in</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Join the team">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">You've been invited to help run The Fluency Talks as <b className="text-ink">{session.user.email}</b>. Choose a password for this account. You'll use it every time, along with Google Authenticator.</p>
        <Input id="pw" type="password" label="Password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <Input id="pw2" type="password" label="Repeat password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        <p className="text-xs text-muted">At least {MIN_PASSWORD} characters.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" full loading={busy}>Accept invitation</Button>
      </form>
    </AuthLayout>
  );
}
