import { useEffect, useState } from 'react';
import { Button, Modal, Textarea } from '@/components/ui';
import { adminSetUserStatus } from '@/services';
import type { AccountStatus } from '@/types/db';

export interface ModTarget { userId: string; name: string; status: AccountStatus; reportId?: string }   // status = the NEW status to apply
const copy: Record<AccountStatus, { title: string; hint: string; button: string }> = {
  suspended: { title: 'Suspend', hint: 'They keep their data but cannot message, follow or report until reinstated.', button: 'Suspend' },
  banned: { title: 'Ban', hint: 'Also blocks this email address from signing up again.', button: 'Ban' },
  active: { title: 'Reinstate', hint: 'Restores access and lifts the email ban if there was one.', button: 'Reinstate' },
};
/** One confirmation step for every status change. A reason is required to suspend or ban and is kept in the activity log. */
export function ModerationDialog({ target, onClose, onDone }: { target: ModTarget | null; onClose: () => void; onDone: (t: ModTarget) => void }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setReason(''); setError(''); }, [target?.userId, target?.status]);
  if (!target) return null;
  const c = copy[target.status]; const needsReason = target.status !== 'active';
  const submit = async () => {
    setBusy(true); setError('');
    try { await adminSetUserStatus(target.userId, target.status, reason.trim() || undefined, target.reportId); onDone(target); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${c.title} ${target.name}?`}>
      <p className="text-sm text-muted">{c.hint}</p>
      <Textarea label={needsReason ? 'Reason (required)' : 'Note (optional)'} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={target.status === 'active' ? 'primary' : 'danger'} loading={busy} disabled={needsReason && reason.trim().length < 3} onClick={submit}>{c.button}</Button></div>
    </Modal>
  );
}
