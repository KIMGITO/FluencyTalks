import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, Card, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useThemeStore } from '@/store/themeStore';
import { deleteAccount, exportMyData } from '@/services';
import { BlockedList } from '@/components/features';
export default function Settings() {
  const { updatePassword, updateEmail, signOut, error } = useAuthStore(); const { mode, setMode } = useThemeStore(); const role = useProfileStore((s) => s.me?.role);
  const [pw, setPw] = useState(''); const [email, setEmail] = useState(''); const [msg, setMsg] = useState('');
  const onDelete = async () => {
    if (!confirm('Delete your account and all your data? This cannot be undone.')) return;
    try { await deleteAccount(); await signOut(); } catch (e) { setMsg((e as Error).message); }
  };
  const onExport = async () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(await exportMyData(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'fluencytalks-data.json'; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader title="Settings" subtitle="Account, password and appearance" />
      <div className="flex flex-col gap-2">
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Profile</h2><div className="flex flex-wrap gap-1.5"><Link to="/profile/edit"><Button variant="secondary" size="sm">Edit profile and languages</Button></Link><Link to="/phrasebook"><Button variant="secondary" size="sm">Phrasebook</Button></Link>{(role === 'admin' || role === 'moderator') && <Link to="/admin"><Button variant="secondary" size="sm">Moderation</Button></Link>}</div></Card>
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Appearance</h2>
          <div className="flex gap-1.5">{(['light', 'dark', 'system'] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? 'primary' : 'secondary'} onClick={() => setMode(m)}>{m}</Button>)}</div></Card>
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Change email</h2>
          <Input type="email" placeholder="new@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button size="sm" className="self-start" onClick={async () => setMsg((await updateEmail(email)) ? 'Check both inboxes to confirm.' : '')}>Update email</Button></Card>
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Change password</h2>
          <Input type="password" minLength={8} placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button size="sm" className="self-start" onClick={async () => setMsg((await updatePassword(pw)) ? 'Password updated.' : '')}>Update password</Button></Card>
        {(msg || error) && <p className={error ? 'text-danger' : 'text-success'}>{error || msg}</p>}
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Blocked people</h2><BlockedList /></Card>
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Session</h2><Button variant="secondary" size="sm" className="self-start" onClick={signOut}>Log out</Button></Card>
        <Card className="flex flex-col gap-2"><h2 className="font-semibold">Your data</h2><p className="text-sm text-muted">Download a copy of everything we store about you.</p><Button variant="secondary" size="sm" className="self-start" onClick={onExport}>Export my data</Button></Card>
        <Card className="flex flex-col gap-2"><h2 className="font-semibold text-danger">Delete account</h2><p className="text-sm text-muted">Permanently removes your account, messages and profile. <Link to="/data-deletion" className="underline">How deletion works</Link></p><Button variant="danger" size="sm" className="self-start" onClick={onDelete}>Delete account</Button></Card>
      </div>
    </>
  );
}
