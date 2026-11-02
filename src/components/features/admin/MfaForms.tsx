import { useEffect, useRef, useState, type FormEvent } from 'react';
import qrcode from 'qrcode-generator';
import { Button, Card, Input, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError, totpSetupLink } from '@/lib/authHelpers';
import { adminGenerateRecoveryCodes, redeemRecoveryCode, reportMfaFailure } from '@/services/admin';
import { useAuthStore } from '@/store/authStore';

const cleanCode = (v: string) => v.replace(/\D/g, '').slice(0, 6);
const CodeInput = ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
  <Input id={id} label="6-digit code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={value} onChange={(e) => onChange(cleanCode(e.target.value))} required />
);

/** Drawn here, not by Supabase: its code carries a longer link at a higher error-correction level, and phones struggle to scan it. */
function setupQrImage(link: string) {
  const qr = qrcode(0, 'L');
  qr.addData(link);
  qr.make();
  // A wide white margin is part of the code: scanners use it to find the edges.
  return `data:image/svg+xml,${encodeURIComponent(qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true }))}`;
}

/** Shows the QR code. Nothing is switched on until a code from the app proves the scan worked. */
export function MfaEnroll({ friendlyName, onDone, onCancel }: { friendlyName: string; onDone: () => void; onCancel?: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;   // StrictMode mounts twice; a second enrol would leave a stray factor
    started.current = true;
    void (async () => {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName, issuer: 'The Fluency Talks' });
      if (e || !data) { setError(friendlyAuthError(e?.message ?? 'Could not start the setup. Please try again.')); return; }
      setFactor({ id: data.id, qr: setupQrImage(totpSetupLink(data.totp.secret, useAuthStore.getState().user?.email)), secret: data.totp.secret });
    })();
  }, [friendlyName]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor!.id, code });
    setBusy(false);
    if (err) { setError("That code didn't work. Wait for a new one and try again."); setCode(''); return; }
    onDone();
  };

  if (!factor) return error ? <p role="alert" className="text-sm text-danger">{error}</p> : <div className="flex justify-center py-8"><Spinner /></div>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Open Google Authenticator and tap <b className="text-ink">+</b>, then <b className="text-ink">Scan a QR code</b>.</li>
        <li>Scan this code, then type the 6 digits the app shows.</li>
      </ol>
      {/* White behind the code in dark mode too: scanners need the contrast. */}
      <div className="flex justify-center"><img src={factor.qr} alt="QR code for your authenticator app" width={304} height={304} className="h-auto max-w-full rounded-md bg-white" /></div>
      <details className="text-sm text-muted"><summary className="cursor-pointer font-semibold">Can't scan it?</summary>
        <p className="mt-1">Choose <b className="text-ink">Enter a setup key</b> in the app and type:</p>
        <code className="mt-1 block break-all rounded-md bg-surface-2 p-2 text-xs text-ink">{factor.secret}</code>
      </details>
      <CodeInput id="enroll-code" value={code} onChange={setCode} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        {onCancel && <Button type="button" variant="secondary" full onClick={onCancel}>Cancel</Button>}
        <Button type="submit" full loading={busy} disabled={code.length !== 6}>Turn on</Button>
      </div>
    </form>
  );
}

/** Asks for the code at login, with the way out for someone who has lost the phone. */
export function MfaChallenge({ onDone, onRecovered }: { onDone: () => void; onRecovered: () => void }) {
  const [factors, setFactors] = useState<{ id: string; name: string }[] | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState(''); const [recovery, setRecovery] = useState(''); const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const list = (data?.totp ?? []).map((f) => ({ id: f.id, name: f.friendly_name ?? 'Authenticator' }));
      setFactors(list); setFactorId(list[0]?.id ?? '');
    });
  }, []);

  const verify = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (err) { void reportMfaFailure(); setError(err.message.toLowerCase().includes('rate') ? 'Too many attempts. Wait a minute and try again.' : "That code didn't work. Wait for a new one and try again."); setCode(''); return; }
    onDone();
  };
  const recover = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await redeemRecoveryCode(recovery); onRecovered(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  if (!factors) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (useRecovery) return (
    <form onSubmit={recover} className="space-y-4">
      <p className="text-sm text-muted">A recovery code removes your authenticators, signs out your other sessions, and takes you to a new QR code. Each code works once.</p>
      <Input id="recovery-code" label="Recovery code" autoComplete="off" autoFocus value={recovery} onChange={(e) => setRecovery(e.target.value)} required />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={busy} disabled={!recovery.trim()}>Use recovery code</Button>
      <button type="button" className="w-full text-sm font-semibold text-brand" onClick={() => { setUseRecovery(false); setError(''); }}>Back to the 6-digit code</button>
    </form>
  );
  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-muted">Open Google Authenticator and type the code for The Fluency Talks.</p>
      {factors.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Which authenticator">
          {factors.map((f) => <Button key={f.id} type="button" size="sm" variant={f.id === factorId ? 'primary' : 'secondary'} onClick={() => setFactorId(f.id)}>{f.name}</Button>)}
        </div>
      )}
      <CodeInput id="mfa-code" value={code} onChange={setCode} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={busy} disabled={code.length !== 6}>Verify</Button>
      <button type="button" className="w-full text-sm font-semibold text-brand" onClick={() => { setUseRecovery(true); setError(''); }}>Lost your authenticator?</button>
    </form>
  );
}

/** The only time these codes are ever visible: the database keeps just their hashes. */
export function RecoveryCodes({ onDone }: { onDone: () => void }) {
  const [codes, setCodes] = useState<string[] | null>(null); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [copied, setCopied] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;   // a second run would cancel the set on screen
    started.current = true;
    adminGenerateRecoveryCodes().then(setCodes).catch((e) => setError((e as Error).message));
  }, []);
  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!codes) return <div className="flex justify-center py-8"><Spinner /></div>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Save these somewhere safe and away from your phone, such as a password manager. They get you back in if you lose your authenticator, and you won't see them again.</p>
      <Card pad={false} className="grid grid-cols-1 gap-x-4 gap-y-1 bg-surface-2 p-3 font-mono text-xs sm:grid-cols-2">{codes.map((c) => <code key={c} className="whitespace-nowrap">{c}</code>)}</Card>
      <Button type="button" variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(codes.join('\n')).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy all'}</Button>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved these codes</label>
      <Button full disabled={!saved} onClick={onDone}>Continue</Button>
    </div>
  );
}
