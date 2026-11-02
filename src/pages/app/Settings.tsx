import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Palette, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Input, tabClass, tabsClass } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { setShowActivity } from '@/services/presence';
import { toast } from '@/store/toastStore';
import { isOAuthOnly } from '@/lib/session';
import { useThemeStore } from '@/store/themeStore';
import { exportMyData } from '@/services';
import { BlockedList } from '@/components/features';
import { BRAND, SUPPORT_SUBJECT } from '@/lib/site';
import { EMAILS, mailto } from '@/lib/emails';
import clsx from 'clsx';

type Tab = 'profile' | 'privacy' | 'appearance';

const tabs: { key: Tab; label: string; icon: typeof UserRound }[] = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'privacy', label: 'Privacy', icon: Lock },
  { key: 'appearance', label: 'Appearance', icon: Palette },
];


export default function Settings() {
  const { updatePassword, updateEmail, error } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  
  const oauthOnly = isOAuthOnly(user);
  const me = useProfileStore((s) => s.me);
  const reloadProfile = useProfileStore((s) => s.load);
  const { mode, setMode } = useThemeStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [pw, setPw] = useState(''); const [email, setEmail] = useState(''); const [msg, setMsg] = useState('');
  const changeActivity = async (show: boolean) => {
    setMsg('');
    try { await setShowActivity(show); if (me) await reloadProfile(me.id); toast.success(show ? 'Activity status is on.' : 'Activity status is off.'); }
    catch (e) { toast.error((e as Error).message); }
  };
  // Real stages only. The server doesn't report a percentage, so none is shown.
  const [exportStage, setExportStage] = useState<'idle' | 'preparing' | 'packaging' | 'done' | 'failed'>('idle');
  const onExport = async () => {
    if (exportStage === 'preparing' || exportStage === 'packaging') return;
    setExportStage('preparing');
    try {
      const data = await exportMyData();
      setExportStage('packaging');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'the-fluency-talks-data.json'; a.click(); URL.revokeObjectURL(url);
      setExportStage('done');
      toast.success('Your data has been downloaded.');
    } catch { setExportStage('failed'); }
  };
  return (
    <>
      <PageHeader title="Settings" subtitle="Profile, privacy and appearance" />
      <div role="tablist" aria-label="Settings sections" className={clsx("ft-inset", tabsClass)}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={clsx(tabClass(tab === key), 'flex items-center gap-1.5')}>
            <Icon size={15} /> {label}</button>))}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {(msg || error) && <p className={clsx('ft-inset', error ? 'text-danger' : 'text-success')}>{error || msg}</p>}

        {tab === 'profile' && (<>
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Profile card</h2>
            <p className="text-sm text-muted">How you appear to others: Name, Photo, Bio, Languages and Country. Session & account (log out, delete) lives at the bottom of your profile.</p>
            <div className="flex flex-wrap gap-1.5">
              <Link to="/profile/edit"><Button variant="secondary" size="sm">Edit profile and languages</Button></Link>
              <Link to="/profile"><Button variant="secondary" size="sm">View my profile card</Button></Link>
            </div></Card>
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Change email</h2>
            <Input type="email" placeholder="new@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button size="sm" className="self-start" onClick={async () => setMsg((await updateEmail(email)) ? 'Check both inboxes to confirm.' : '')}>Update email</Button></Card>
        </>)}

        {tab === 'privacy' && (<>
          {oauthOnly ? (
            <Card className="flex flex-col gap-2"><h2 className="font-semibold">Password</h2>
              <p className="text-sm text-muted">You signed in with Google, so there is no password on this account. Use Google to log in on every device.</p></Card>
          ) : (
            <Card className="flex flex-col gap-2"><h2 className="font-semibold">Change password</h2>
              <Input type="password" minLength={8} placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Button size="sm" className="self-start" onClick={async () => setMsg((await updatePassword(pw)) ? 'Password updated.' : '')}>Update password</Button></Card>
          )}
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Activity status</h2>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={me?.show_activity !== false} onChange={(e) => void changeActivity(e.target.checked)} />
              <span>Show when I'm online and when I was last active.<span className="block text-xs text-muted">If you turn this off, you won't see it for other people either. Blocked people never see it.</span></span>
            </label></Card>
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Blocked people</h2><BlockedList /></Card>
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Your data</h2><p className="text-sm text-muted">Download a copy of everything we store about you. For deletion or privacy requests email <a className="underline" href={mailto(EMAILS.privacy, { subject: 'Privacy request' })}>{EMAILS.privacy}</a>.</p><Button variant="secondary" size="sm" className="self-start" loading={exportStage === 'preparing' || exportStage === 'packaging'} onClick={onExport}>Export my data</Button>
            {exportStage !== 'idle' && (
              <p role="status" className={exportStage === 'failed' ? 'text-sm text-danger' : 'text-sm text-muted'}>
                {exportStage === 'preparing' && 'Gathering your data. This can take a moment.'}
                {exportStage === 'packaging' && 'Packaging the file.'}
                {exportStage === 'done' && 'Done. Check your downloads.'}
                {exportStage === 'failed' && <>Couldn't export your data. Nothing was downloaded. <button type="button" className="font-bold underline" onClick={onExport}>Try again</button></>}
              </p>
            )}</Card>
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Need help?</h2><p className="text-sm text-muted">Contact support at <a className="underline" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>{EMAILS.support}</a>. For urgent safety issues write to <a className="underline" href={mailto(EMAILS.security, { subject: 'Urgent safety issue' })}>{EMAILS.security}</a>.</p></Card>
        </>)}

        {tab === 'appearance' && (
          <Card className="flex flex-col gap-2"><h2 className="font-semibold">Appearance</h2>
            <p className="text-sm text-muted">Light, dark, or follow your device.</p>
            <div className="flex gap-1.5">{(['light', 'dark', 'system'] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? 'primary' : 'secondary'} onClick={() => setMode(m)}>{m}</Button>)}</div></Card>)}
      </div>
    </>
  );
}
