import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
export default function ForgotPassword() {
  const { sendPasswordReset, error } = useAuthStore(); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setSent(await sendPasswordReset(email)); };
  return (
    <AuthLayout title="Reset your password">
      {sent ? <p className="text-muted">If an account exists for {email}, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <Input id="email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" full>Send reset link</Button>
        </form>)}
      <Link className="text-sm text-brand" to="/login">Back to log in</Link>
    </AuthLayout>
  );
}
