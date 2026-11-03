import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Download, Eye, KeyRound, LifeBuoy, Lock, Mail, Monitor, Moon, Palette, Pencil, Sun, UserRound, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, buttonClass, Card, Input, tabClass, tabsClass } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { setShowActivity } from '@/services/presence';
import { toast } from '@/store/toastStore';
import { isOAuthOnly } from '@/lib/session';
import { useThemeStore } from '@/store/themeStore';
import { exportMyData } from '@/services';
import { AccountZone, BlockedList } from '@/components/features';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { SUPPORT_SUBJECT } from '@/lib/site';
import { EMAILS, mailto } from '@/lib/emails';
import clsx from 'clsx';
import { userMessage } from '@/lib/errors';
import { checkEmail, checkPassword } from '@/lib/validate';

type Tab = 'profile' | 'privacy' | 'appearance';

const tabs: { key: Tab; label: string; icon: typeof UserRound }[] = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'privacy', label: 'Privacy', icon: Lock },
  { key: 'appearance', label: 'Appearance', icon: Palette },
];

/** One settings block: icon, title, short explanation, then the control. */
function Section({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon size={17} aria-hidden /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div><h2 className="font-semibold text-ink">{title}</h2>{text && <p className="text-sm text-muted">{text}</p>}</div>
        {children}
      </div>
    </Card>
  );
}

const themeModes = [{ key: 'light', label: 'Light', icon: Sun }, { key: 'dark', label: 'Dark', icon: Moon }, { key: 'system', label: 'Device', icon: Monitor }] as const;

export default function Settings() {
  const { updatePassword, updateEmail, error } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  
  const oauthOnly = isOAuthOnly(user);
  const me = useProfileStore((s) => s.me);
  const reloadProfile = useProfileStore((s) => s.load);
  const providerAvatar = useProviderAvatar();
  const { mode, setMode } = useThemeStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [pw, setPw] = useState(''); const [email, setEmail] = useState(''); const [msg, setMsg] = useState('');
  const changeActivity = async (show: boolean) => {
    setMsg('');
    try { await setShowActivity(show); if (me) await reloadProfile(me.id); toast.success(show ? 'Activity status is on.' : 'Activity status is off.'); }
    catch (e) { toast.error(userMessage(e)); }
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
      <PageHeader title="Settings" subtitle="Account, privacy and appearance" />
      {/* Who you are, at a glance */}
      <Card className="mb-3 flex items-center gap-3">
        <Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="lg" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-medium leading-tight text-ink">{me?.display_name ?? 'Your profile'}</p>
          {me?.username && <p className="truncate text-sm text-muted">@{me.username}</p>}
          {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          <Link to="/profile/edit" className={buttonClass('secondary', 'sm')}><Pencil size={14} aria-hidden /> Edit</Link>
          <Link to="/profile" className="text-sm font-medium text-brand hover:underline">View profile</Link>
        </div>
      </Card>
      <div role="tablist" aria-label="Settings sections" className={clsx("ft-inset", tabsClass)}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={clsx(tabClass(tab === key), 'flex items-center gap-1.5')}>
            <Icon size={15} /> {label}</button>))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {(msg || error) && <p className={clsx('ft-inset', error ? 'text-danger' : 'text-success')}>{error || msg}</p>}

        {tab === 'profile' && (<>
          <Section icon={UserRound} title="Profile" text="Name, photo, bio, languages and country: how others see you.">
            <Link to="/profile/edit" className={clsx(buttonClass('secondary', 'sm'), 'self-start')}>Edit profile and languages</Link>
          </Section>
          <Section icon={Mail} title="Email" text={user?.email ? <>Currently <span className="font-medium text-ink">{user.email}</span></> : undefined}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1"><Input type="email" placeholder="new@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button size="sm" variant="secondary" className="self-start sm:h-12" disabled={!email.trim()} onClick={async () => { const problem = checkEmail(email); if (problem) { toast.error(problem); return; } setMsg((await updateEmail(email.trim())) ? 'Check both inboxes to confirm.' : ''); }}>Update email</Button>
            </div>
          </Section>
        </>)}

        {tab === 'privacy' && (<>
          {oauthOnly ? (
            <Section icon={KeyRound} title="Password" text="You signed in with Google, so there is no password on this account. Use Google to log in on every device." />
          ) : (
            <Section icon={KeyRound} title="Password" text="At least 8 characters.">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1"><Input type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
                <Button size="sm" variant="secondary" className="self-start sm:h-12" disabled={!pw} onClick={async () => { const problem = checkPassword(pw); if (problem) { toast.error(problem); return; } setMsg((await updatePassword(pw)) ? 'Password updated.' : ''); }}>Update password</Button>
              </div>
            </Section>
          )}
          <Section icon={Eye} title="Activity status">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={me?.show_activity !== false} onChange={(e) => void changeActivity(e.target.checked)} />
              <span>Show when I'm online and when I was last active.<span className="block text-xs text-muted">If you turn this off, you won't see it for other people either. Blocked people never see it.</span></span>
            </label>
          </Section>
          <Section icon={Ban} title="Blocked people"><BlockedList /></Section>
          <Section icon={Download} title="Your data" text={<>Download a copy of everything we store about you. For deletion or privacy requests email <a className="underline" href={mailto(EMAILS.privacy, { subject: 'Privacy request' })}>{EMAILS.privacy}</a>.</>}>
            <Button variant="secondary" size="sm" className="self-start" loading={exportStage === 'preparing' || exportStage === 'packaging'} onClick={onExport}>Export my data</Button>
            {exportStage !== 'idle' && (
              <p role="status" className={exportStage === 'failed' ? 'text-sm text-danger' : 'text-sm text-muted'}>
                {exportStage === 'preparing' && 'Gathering your data. This can take a moment.'}
                {exportStage === 'packaging' && 'Packaging the file.'}
                {exportStage === 'done' && 'Done. Check your downloads.'}
                {exportStage === 'failed' && <>Couldn't export your data. Nothing was downloaded. <button type="button" className="font-bold underline" onClick={onExport}>Try again</button></>}
              </p>
            )}
          </Section>
          <Section icon={LifeBuoy} title="Need help?" text={<>Contact support at <a className="underline" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>{EMAILS.support}</a>. For urgent safety issues write to <a className="underline" href={mailto(EMAILS.security, { subject: 'Urgent safety issue' })}>{EMAILS.security}</a>.</>} />
        </>)}

        {tab === 'appearance' && (
          <Section icon={Palette} title="Appearance" text="Light, dark, or follow your device.">
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
              {themeModes.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMode(key)}
                  className={clsx('flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-sm font-semibold transition-colors', mode === key ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:bg-surface-2 hover:text-ink')}>
                  <Icon size={18} aria-hidden /> {label}
                </button>
              ))}
            </div>
          </Section>)}

        <div className="mt-4"><AccountZone /></div>
      </div>
    </>
  );
}
