import { useEffect, useState } from 'react';
import { Button, Modal, Textarea } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { adminSetUserStatus } from '@/services';
import { refreshAdminCounts } from '@/store/adminStore';
import type { AccountStatus } from '@/types/db';
import { cleanText } from '@/lib/validate';

export interface ModTarget { userId: string; name: string; status: AccountStatus; reportId?: string }
const copy: Record<AccountStatus, { title: string; hint: string; button: string; done: string }> = {
  suspended: { title: 'Suspend', hint: 'They keep their data but cannot message or report until reinstated.', button: 'Suspend', done: 'suspended' },
  banned: { title: 'Ban', hint: 'Also blocks this email address from signing up again.', button: 'Ban', done: 'banned' },
  active: { title: 'Reinstate', hint: 'Restores access and lifts the email ban if there was one.', button: 'Reinstate', done: 'reinstated' },
};
export function ModerationDialog({ target, onClose, onDone }: { target: ModTarget | null; onClose: () => void; onDone: (t: ModTarget) => void }) {
  const [reason, setReason] = useState('');
  const submit = useAction(async (t: ModTarget) => { await adminSetUserStatus(t.userId, t.status, cleanText(reason) || undefined, t.reportId); return t; }, {
    silent: true,
    success: (_r, t) => `${t.name} ${copy[t.status].done}.`,
    onDone: (t) => { void refreshAdminCounts(); onDone(t as ModTarget); },
  });
  useEffect(() => { setReason(''); submit.clearError(); }, [target?.userId, target?.status]);
  if (!target) return null;
  const c = copy[target.status]; const needsReason = target.status !== 'active';
  return (
    <Modal open onClose={() => { if (!submit.busy) onClose(); }} title={`${c.title} ${target.name}?`}>
      <p className="text-sm text-muted">{c.hint}</p>
      <Textarea label={needsReason ? 'Reason (required)' : 'Note (optional)'} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      {submit.error && <p role="alert" className="text-sm text-danger">{submit.error}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={submit.busy} onClick={onClose}>Cancel</Button>
        <Button variant={target.status === 'active' ? 'primary' : 'danger'} loading={submit.busy} disabled={needsReason && cleanText(reason).length < 3} onClick={() => void submit.run(target)}>{c.button}</Button></div>
    </Modal>
  );
}
