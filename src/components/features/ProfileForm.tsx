import { useState, type FormEvent } from 'react';
import { Avatar, Button, Input, Select, Textarea } from '@/components/ui';
import { LanguagePicker } from './LanguagePicker';
import { MAX_AVATAR_BYTES } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { recordConsent, uploadAvatar } from '@/services';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const zones = (): string[] => (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];

/** Used for onboarding and for editing your profile. */
export function ProfileForm({ mode, onDone }: { mode: 'onboarding' | 'edit'; onDone: () => void }) {
  const user = useAuthStore((s) => s.user)!; const { me, languages, save } = useProfileStore();
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [username, setUsername] = useState(me?.username ?? ''); const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? ''); const [tz, setTz] = useState(me?.timezone ?? localTz); const [isPrivate, setPrivate] = useState(me?.is_private ?? false);
  const [langs, setLangs] = useState(languages); const [file, setFile] = useState<File | null>(null); const [adult, setAdult] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const pick = (f?: File) => { if (f && f.size > MAX_AVATAR_BYTES) return setError('Photo must be under 2 MB.'); setError(null); setFile(f ?? null); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    if (!USERNAME_RE.test(username)) return setError('Username: 3 to 20 letters, numbers or underscores.');
    if (!langs.length) return setError('Add at least one language.');
    if (!adult) return setError('You must be 18 or older to join.');
    setBusy(true);
    try {
      const avatarUrl = file ? await uploadAvatar(user.id, file) : undefined;
      await save({ username, displayName: displayName.trim() || username, bio, timezone: tz, isPrivate, avatarUrl }, langs);
      if (mode === 'onboarding') await Promise.all([recordConsent('age_18', '1'), recordConsent('terms', '1'), recordConsent('privacy', '1')]);
      onDone();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={displayName || username || 'U'} src={file ? URL.createObjectURL(file) : me?.avatar_url} size="xl" ring />
        <label className="text-sm text-brand"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /><span className="cursor-pointer font-medium">Choose photo</span></label>
      </div>
      <Input id="username" label="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required />
      <Input id="displayName" label="Display name" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
      <Textarea label="About you" rows={3} maxLength={300} value={bio} placeholder="Interests, why you're learning, what you can help with" onChange={(e) => setBio(e.target.value)} />
      <Select label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)}>{[...new Set([tz, ...zones()])].map((z) => <option key={z}>{z}</option>)}</Select>
      <LanguagePicker value={langs} onChange={setLangs} />
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} /><span><b>Private profile.</b> People must request to follow you.</span></label>
      {mode === 'onboarding' && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>I'm 18 or older and agree to the Terms and Privacy Policy.</span></label>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={busy}>{mode === 'onboarding' ? 'Finish setup' : 'Save changes'}</Button>
    </form>
  );
}
