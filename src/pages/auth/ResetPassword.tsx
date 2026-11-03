import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input, Spinner } from '@/components/ui';
import { MfaChallenge } from '@/components/features/admin/MfaForms';
import { supabase } from '@/lib/supabase';
import { myStaffStatus } from '@/services/admin';
import { useAuthStore } from '@/store/authStore';
import { useSeo } from '@/hooks/useSeo';
import { checkPassword } from '@/lib/validate';

/**
 * Opened from the link in the password-reset email. Three outcomes:
 *  - the link works: a recovery session exists, so show the form;
 *  - the link is expired or already used (Supabase says so in the URL) or there is no session: say so
 *    and point to a new request, instead of showing a form that can only fail;
 *  - the password is saved: confirm, then go to the app.
 * Staff have one more step each way: Supabase will not change a password on an account with an authenticator
 * until the code is given, and afterwards they log in again, because the admin area needs a password login.
 */
export default function ResetPassword() {
  useSeo({ title: 'Choose a new password', description: 'Choose a new password for your The Fluency Talks account.', path: '/reset-password', noIndex: true });
  const { updatePassword, signOut, clearError, error, session, loading, recoveryLinkError } = useAuthStore();
  const nav = useNavigate();
  const [pw, setPw] = useState(''); const [again, setAgain] = useState('');
  const [problem, setProblem] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const [needsCode, setNeedsCode] = useState(false); const [staff, setStaff] = useState(false);
  useEffect(() => { clearError(); }, [clearError]);
  useEffect(() => {
    if (!session) return;
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => setNeedsCode(data?.nextLevel === 'aal2' && data.currentLevel === 'aal1'));
    void myStaffStatus().then((s) => setStaff(s.is_staff)).catch(() => undefined);
  }, [session?.user.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setProblem('');
    const found = checkPassword(pw, staff ? 12 : 8) || (pw !== again ? 'The two passwords do not match.' : '');
    if (found) { setProblem(found); return; }
    setBusy(true);
    const ok = await updatePassword(pw);
    setBusy(false);
    if (ok && staff) {
      await signOut();
      nav('/login', { replace: true, state: { reason: 'Password updated. Log in with it to continue.' } });
      return;
    }
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

  if (needsCode) return <AuthLayout title="Enter your code"><MfaChallenge onDone={() => setNeedsCode(false)} onRecovered={() => setNeedsCode(false)} /></AuthLayout>;

  return (
    <AuthLayout title="Choose a new password">
      <form noValidate onSubmit={submit} className="space-y-3">
        <Input id="pw" type="password" label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Input id="pw2" type="password" label="Repeat password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        <p className="text-xs text-muted">At least {staff ? 12 : 8} characters.</p>
        {(problem || error) && <p className="text-sm text-danger">{problem || error}</p>}
        <Button type="submit" full loading={busy}>Save password</Button>
      </form>
    </AuthLayout>
  );
}
