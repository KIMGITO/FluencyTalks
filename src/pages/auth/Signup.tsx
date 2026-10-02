import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { SocialButtons } from '@/components/features';
import { useAuthStore } from '@/store/authStore';
export default function Signup() {
  const { signUp, error } = useAuthStore();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setSent(await signUp(email, password)); setBusy(false); };
  if (sent) return <AuthLayout title="Check your email"><p className="text-muted">We sent a confirmation link to {email}. Open it to finish creating your account.</p></AuthLayout>;
  return (
    <AuthLayout title="Create your account">
      <SocialButtons />
      <form onSubmit={submit} className="space-y-3">
        <Input id="email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input id="password" type="password" label="Password (8+ characters)" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" full loading={busy}>Sign up</Button>
      </form>
      <p className="text-sm text-muted">Already have an account? <Link className="text-brand" to="/login">Log in</Link></p>
    </AuthLayout>
  );
}
