import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button, Card, ConfirmDialog, ErrorState, Input, RowListSkeleton } from '@/components/ui';
import { friendlyAuthError } from '@/lib/authHelpers';
import { formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { myStaffStatus } from '@/services/admin';
import { toast } from '@/store/toastStore';
import { MfaEnroll, RecoveryCodes } from './MfaForms';

interface Factor { id: string; friendly_name?: string; created_at: string }
const MIN_PASSWORD = 12;

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
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">Authenticators</h2>
        {adding ? (
          <MfaEnroll friendlyName={`Backup ${factors.length}`} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); toast.success('Backup authenticator added.'); void load(); }} />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {factors.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm first:pt-0">
                  <ShieldCheck size={18} aria-hidden className="text-success" />
                  <span className="min-w-0 flex-1 basis-40"><b>{f.friendly_name ?? 'Authenticator'}</b><span className="block text-xs text-muted">Added {formatTime(f.created_at)}</span></span>
                  {factors.length > 1 && <Button size="sm" variant="ghost" onClick={() => setRemoving(f)}>Remove</Button>}
                </li>
              ))}
            </ul>
            {factors.length === 1 && <p className="flex items-start gap-2 text-sm"><TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" /> You have one authenticator. Add a backup on a second device so a lost phone doesn't lock you out.</p>}
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Add a backup authenticator</Button>
          </>
        )}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Recovery codes</h2>
        {showCodes ? <RecoveryCodes onDone={() => { setShowCodes(false); void load(); }} /> : (
          <>
            <p className="text-sm text-muted"><b className="text-ink tabular-nums">{codesLeft}</b> unused. Each one gets you back in once if you lose every authenticator.</p>
            <Button size="sm" variant="secondary" onClick={() => setConfirmCodes(true)}>Make new codes</Button>
          </>
        )}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <Input id="new-pw" type="password" label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <Input id="new-pw2" type="password" label="Repeat password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          <p className="text-xs text-muted">At least {MIN_PASSWORD} characters.</p>
          {pwError && <p role="alert" className="text-sm text-danger">{pwError}</p>}
          <Button type="submit" size="sm" loading={pwBusy}>Change password</Button>
        </form>
      </Card>
      <ConfirmDialog open={confirmCodes} title="Make new recovery codes?" confirmLabel="Make new codes" onClose={() => setConfirmCodes(false)} onConfirm={async () => { setShowCodes(true); }}>
        Your current codes stop working.
      </ConfirmDialog>
      <ConfirmDialog open={!!removing} danger title={`Remove ${removing?.friendly_name ?? 'this authenticator'}?`} confirmLabel="Remove" onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const { error } = await supabase.auth.mfa.unenroll({ factorId: removing!.id });
          if (error) throw new Error(friendlyAuthError(error.message));
          await load();
        }}>
        Its codes stop working straight away.
      </ConfirmDialog>
    </div>
  );
}
