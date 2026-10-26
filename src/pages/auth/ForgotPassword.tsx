import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS, mailto } from '@/lib/emails';
export default function ForgotPassword() {
  useSeo({ title: 'Forgot password', description: 'Reset your The Fluency Talks password. We email you a secure reset link.', path: '/forgot-password', noIndex: true });
  const { sendPasswordReset, clearError, error } = useAuthStore();
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { clearError(); }, [clearError]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setSent(await sendPasswordReset(email.trim())); setBusy(false); };
  return (
    <AuthLayout title="Reset your password">
      {sent ? (
        <div className="space-y-2 text-sm text-muted">
          <p>If there is an account for <span className="font-medium text-ink">{email.trim()}</span>, a reset link is on its way. It works once and lasts one hour.</p>
          <p>Nothing after a few minutes? Check your spam folder.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Input id="email" type="email" label="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" full loading={busy}>Send reset link</Button>
        </form>)}
      <p className="text-sm text-muted">Still stuck? Write to <a className="text-brand underline" href={mailto(EMAILS.support, { subject: 'Password reset help' })}>{EMAILS.support}</a>.</p>
      <Link className="text-sm text-brand" to="/login">Back to log in</Link>
    </AuthLayout>
  );
}
