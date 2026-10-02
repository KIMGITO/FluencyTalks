import { useEffect, useState } from 'react';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminRecentActions } from '@/services';
import type { AdminAction } from '@/types/db';

const verbs: Record<AdminAction['action'], string> = { suspend: 'suspended', ban: 'banned', reinstate: 'reinstated', dismiss_report: 'dismissed a report', auto_suspend: 'was auto-suspended after repeated reports' };
/** Read-only audit trail of moderation actions (newest first). */
export function AdminActivity() {
  const [items, setItems] = useState<AdminAction[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { adminRecentActions().then(setItems).catch((e) => { setError((e as Error).message); setItems([]); }); }, []);
  if (!items) return <div className="flex justify-center p-6"><Spinner /></div>;
  return (
    <div className="space-y-3">
      {error && <p className="text-danger">{error}</p>}
      {!items.length ? <EmptyState title="No moderation activity yet" /> : <Card className="divide-y divide-border">{items.map((a) => (
        <p key={a.id} className="py-3 text-sm first:pt-0 last:pb-0">
          {a.action === 'auto_suspend' ? <><b>{a.target_name ?? 'A user'}</b> {verbs[a.action]}</>
            : a.action === 'dismiss_report' ? <><b>{a.admin_name ?? 'An admin'}</b> {verbs[a.action]}</>
            : <><b>{a.admin_name ?? 'An admin'}</b> {verbs[a.action]} <b>{a.target_name ?? 'a deleted user'}</b></>}
          <span className="text-muted"> · {formatTime(a.created_at)}</span>
          {a.reason && a.action !== 'dismiss_report' && <span className="block text-muted">Reason: {a.reason}</span>}
        </p>))}</Card>}
    </div>
  );
}
