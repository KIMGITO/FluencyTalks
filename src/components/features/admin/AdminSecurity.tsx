import { useEffect, useState, type FormEvent } from 'react';
import { Check, Circle, KeyRound, LifeBuoy, Plus, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import { Button, ConfirmDialog, ErrorState, Input, RowListSkeleton } from '@/components/ui';
import { friendlyAuthError } from '@/lib/authHelpers';
import { formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { myStaffStatus } from '@/services/admin';
import { toast } from '@/store/toastStore';
import { Chip, Meter, Panel } from './AdminKit';
import { MfaEnroll, RecoveryCodes } from './MfaForms';

interface Factor { id: string; friendly_name?: string; created_at: string }
const MIN_PASSWORD = 12;
const FULL_SET = 10;   // what admin_generate_recovery_codes makes
const LOW_CODES = 3;   // below this the Health page flags the account too

const Rule = ({ ok, children }: { ok: boolean; children: string }) => (
  <li className={clsx('flex items-center gap-1.5 text-xs', ok ? 'font-semibold text-success' : 'text-muted')}>{ok ? <Check size={14} aria-hidden /> : <Circle size={14} aria-hidden />}{children}</li>
);

export function AdminSecurity() {
  const [factors, setFactors] = useState<Factor[] | null>(null); const [codesLeft, setCodesLeft] = useState(0); const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false); const [showCodes, setShowCodes] = useState(false); const [confirmCodes, setConfirmCodes] = useState(false); const [removing, setRemoving] = useState<Factor | null>(null);
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [pwError, setPwError] = useState(''); const [pwBusy, setPwBusy] = useState(false);

  const load = async () => {
    try {
      const [{ data, error }, status] = await Promise.all([supabase.auth.mfa.listFactors(), myStaffStatus()]);
      if (error) throw error;
      setFactors(data.totp); setCodesLeft(status.recovery_codes_left ?? 0); setFailed(false);
    } catch { setFailed(true); }
  };
  useEffect(() => { void load(); }, []);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); setPwError('');
    if (pw.length < MIN_PASSWORD) { setPwError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (pw !== pw2) { setPwError('The two passwords do not match.'); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) { setPwError(friendlyAuthError(error.message)); return; }
    setPw(''); setPw2(''); toast.success('Password changed.');
  };

  if (failed && !factors) return <ErrorState title="Couldn't load your security settings" onRetry={() => void load()} />;
  if (!factors) return <RowListSkeleton label="Loading your security settings" />;
  const low = codesLeft < LOW_CODES;
  return (
    <div className="space-y-4">
      <Panel title="Authenticators" icon={Smartphone} tone="brand" count={factors.length} action={factors.length > 1 ? <Chip tone="success" icon={ShieldCheck}>Backup ready</Chip> : undefined}>
        {adding ? (
          <MfaEnroll friendlyName={`Backup ${factors.length}`} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); toast.success('Backup authenticator added.'); void load(); }} />
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-border">
              {factors.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm first:pt-0">
                  <ShieldCheck size={18} aria-hidden className="text-success" />
                  <span className="min-w-0 flex-1 basis-[10rem]"><b>{f.friendly_name ?? 'Authenticator'}</b><span className="block text-xs text-muted">Added {formatTime(f.created_at)}</span></span>
                  {factors.length > 1 && <Button size="sm" variant="ghost" onClick={() => setRemoving(f)}>Remove</Button>}
                </li>
              ))}
            </ul>
            {factors.length === 1 && <p className="flex items-start gap-2 rounded-md bg-sun/25 p-2.5 text-sm"><TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" /> You have one authenticator. Add a backup on a second device so a lost phone doesn't lock you out.</p>}
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus size={15} aria-hidden /> Add a backup authenticator</Button>
          </div>
        )}
      </Panel>
      <Panel title="Recovery codes" icon={LifeBuoy} tone="sun" action={!showCodes && low ? <Chip tone="danger" icon={TriangleAlert}>Running low</Chip> : undefined}>
        {showCodes ? <RecoveryCodes onDone={() => { setShowCodes(false); toast.success('New codes are active. The old ones no longer work.'); void load(); }} /> : (
          <div className="space-y-3">
            <div>
              <p className="flex items-baseline gap-1.5"><b className="font-display text-3xl font-medium tabular-nums">{codesLeft}</b> <span className="text-sm text-muted">of {FULL_SET} unused</span></p>
              <span className="mt-1.5 block"><Meter percent={(100 * codesLeft) / FULL_SET} tone={low ? 'danger' : 'success'} label="Recovery codes left" /></span>
              <p className="mt-1.5 text-sm text-muted">Each one gets you back in once if you lose every authenticator.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setConfirmCodes(true)}>Make new codes</Button>
          </div>
        )}
      </Panel>
      <Panel title="Password" icon={KeyRound} tone="accent">
        <form onSubmit={changePassword} className="space-y-3">
          <Input id="new-pw" type="password" label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <Input id="new-pw2" type="password" label="Repeat password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          <ul className="space-y-0.5">
            <Rule ok={pw.length >= MIN_PASSWORD}>{`At least ${MIN_PASSWORD} characters`}</Rule>
            <Rule ok={!!pw && pw === pw2}>Both passwords match</Rule>
          </ul>
          {pwError && <p role="alert" className="text-sm text-danger">{pwError}</p>}
          <Button type="submit" size="sm" loading={pwBusy}>{pwBusy ? 'Changing…' : 'Change password'}</Button>
        </form>
      </Panel>
      <ConfirmDialog open={confirmCodes} title="Make new recovery codes?" confirmLabel="Make new codes" onClose={() => setConfirmCodes(false)} onConfirm={async () => { setShowCodes(true); }}>
        Your current codes stop working.
      </ConfirmDialog>
      <ConfirmDialog open={!!removing} danger title={`Remove ${removing?.friendly_name ?? 'this authenticator'}?`} confirmLabel="Remove" onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const { error } = await supabase.auth.mfa.unenroll({ factorId: removing!.id });
          if (error) throw new Error(friendlyAuthError(error.message));
          toast.success('Authenticator removed.');
          await load();
        }}>
        Its codes stop working straight away.
      </ConfirmDialog>
    </div>
  );
}
