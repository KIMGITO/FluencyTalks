import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Avatar, Button, Input, Select, Textarea } from '@/components/ui';
import { LanguageSelect, type LanguageChoice, type LearnerLevel } from './LanguageSelect';
import { CountryPicker } from './CountryPicker';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { resizeImage } from '@/lib/image';
import { useAuthStore } from '@/store/authStore';
import { useCountries } from '@/store/countryStore';
import { useProfileStore } from '@/store/profileStore';
import { recordConsent, uploadAvatar } from '@/services';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';
import { userMessage } from '@/lib/errors';
import { checkText, checkUsername, cleanText, firstProblem } from '@/lib/validate';

const zones = (): string[] => (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];


export function ProfileForm({ mode, onDone, onError }: { mode: 'onboarding' | 'edit'; onDone: () => void; onError?: (message: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const { me, save } = useProfileStore();
  useCountries();                                   
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [username, setUsername] = useState(me?.username ?? ''); const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? ''); const [tz, setTz] = useState(me?.timezone ?? localTz); const [isPrivate, setPrivate] = useState(me?.is_private ?? false);
  
  const [country, setCountry] = useState<string | null>(me?.country_code ?? null);
  const [langs, setLangs] = useState<LanguageChoice>({ native: me?.native_language_id ?? '', learning: me?.learning_language_id ?? '', level: (me?.learning_level as LearnerLevel | null) ?? 'A1' }); const [file, setFile] = useState<File | null>(null); const [adult, setAdult] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const providerAvatar = useProviderAvatar();
  const [useProvider, setUseProvider] = useState(false);   // switch back from an uploaded photo to the Google one
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  if (!user) return <Navigate to="/login" replace />;

  // Any size or camera photo: it's shrunk on the device before upload.
  const pick = async (f?: File) => {
    setError(null); setUseProvider(false);
    if (!f) return setFile(null);
    try { setFile(await resizeImage(f)); } catch (err) { setError(userMessage(err)); }
  };
  const preview = fileUrl ?? (useProvider ? providerAvatar : resolveAvatar(me?.avatar_url, providerAvatar));
  const hasOwnPhoto = !!me?.avatar_url && me.avatar_url !== providerAvatar;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); onError?.('');
    const problem = firstProblem(checkUsername(username), checkText(displayName, { label: 'Display name', max: 60 }), checkText(bio, { label: 'About you', max: 300 }));
    if (problem) return setError(problem);
    if (!langs.native) return setError('Choose the language you speak natively.');
    if (!adult) return setError('You must be 16 or older to join.');
    setBusy(true);
    try {
      const avatarUrl = file ? await uploadAvatar(user.id, file) : useProvider && providerAvatar ? providerAvatar : undefined;
      await save({ username, displayName: cleanText(displayName, { singleLine: true }) || username, bio: cleanText(bio), timezone: tz, isPrivate, avatarUrl, countryCode: country }, langs);
      if (mode === 'onboarding') await Promise.all([recordConsent('age_18', LEGAL_VERSIONS.age_18), recordConsent('terms', LEGAL_VERSIONS.terms), recordConsent('privacy', LEGAL_VERSIONS.privacy)]);
      onDone();
    } catch (err) {
      const message = userMessage(err, 'Oops! Something went wrong. Please try again.');
      if (onError) onError(message); else setError(message);
    } finally { setBusy(false); }
  };
  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={displayName || username || 'U'} src={preview} size="xl" ring />
        <div className="flex flex-col gap-1">
          <label className="text-sm text-brand"><input type="file" accept="image/*" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} /><span className="cursor-pointer font-medium">{preview ? 'Change photo' : 'Choose photo'}</span></label>
          {file && <button type="button" className="text-left text-xs text-muted hover:text-danger" onClick={() => void pick(undefined)}>Cancel new photo</button>}
          {!file && !useProvider && hasOwnPhoto && providerAvatar && <button type="button" className="text-left text-xs text-muted hover:text-ink" onClick={() => setUseProvider(true)}>Use my Google photo instead</button>}
          {!file && (useProvider || !hasOwnPhoto) && providerAvatar && <p className="text-xs text-muted">Showing your Google photo. Choose one to replace it.</p>}
        </div>
      </div>
      <Input id="username" label="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().trim())} />
      <Input id="displayName" label="Display name" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
      <Textarea label="About you" rows={3} maxLength={300} value={bio} placeholder="Interests, why you're learning, what you can help with" onChange={(e) => setBio(e.target.value)} />
      <Select label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)}>{[...new Set([tz, ...zones()])].map((z) => <option key={z}>{z}</option>)}</Select>
      <CountryPicker value={country} timezone={tz} onChange={setCountry} />
      <LanguageSelect value={langs} onChange={setLangs} />
      
      {mode === 'onboarding' && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>I'm 16 or older and agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</span></label>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={busy}>{mode === 'onboarding' ? 'Finish setup' : 'Save changes'}</Button>
    </form>
  );
}
