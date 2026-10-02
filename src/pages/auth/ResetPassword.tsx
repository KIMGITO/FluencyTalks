import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
export default function ResetPassword() {
  const { updatePassword, error } = useAuthStore(); const nav = useNavigate(); const [pw, setPw] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); if (await updatePassword(pw)) nav('/home'); };
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="space-y-3">
        <Input id="pw" type="password" label="New password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" full>Save password</Button>
      </form>
    </AuthLayout>
  );
}
