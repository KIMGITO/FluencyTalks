import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { SocialButtons } from '@/components/features';
import { useAuthStore } from '@/store/authStore';
export default function Login() {
  const { signIn, error } = useAuthStore(); const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); if (await signIn(email, password)) nav('/home'); setBusy(false); };
  return (
    <AuthLayout title="Welcome back">
      <SocialButtons />
      <form onSubmit={submit} className="space-y-3">
        <Input id="email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input id="password" type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" full loading={busy}>Log in</Button>
      </form>
      <div className="flex justify-between text-sm"><Link className="text-brand" to="/forgot-password">Forgot password?</Link><Link className="text-brand" to="/signup">Create account</Link></div>
    </AuthLayout>
  );
}
