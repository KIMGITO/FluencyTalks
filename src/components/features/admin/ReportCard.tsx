import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { REPORT_REASONS } from '@/lib/constants';
import { formatTime } from '@/lib/format';
import { adminDismissReport } from '@/services';
import type { AdminReport, AccountStatus } from '@/types/db';

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;
/** One report: who reported whom, the message snapshot taken at report time, and the actions. */
export function ReportCard({ report: r, onAct, onResolved }: { report: AdminReport; onAct: (userId: string, name: string, status: AccountStatus, reportId: string) => void; onResolved: () => void }) {
  const [showEvidence, setShowEvidence] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const targetName = r.target_name ?? 'Deleted user'; const open = r.status === 'open'; const ts = r.target_status;
  const dismiss = async () => { setBusy(true); setError(''); try { await adminDismissReport(r.id); onResolved(); } catch (e) { setError((e as Error).message); setBusy(false); } };
  const who = (id: string) => id === r.reporter_id ? 'Reporter' : id === r.target_id ? targetName : 'Other';
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <b>{reasonLabel(r.reason)}</b><span className="text-sm text-muted">{formatTime(r.created_at)}</span>
        {!open && <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold capitalize">{r.status}</span>}
      </div>
      <p className="text-sm">
        <span className="text-muted">Reported by </span>{r.reporter_username ? <Link className="font-medium hover:underline" to={`/u/${r.reporter_username}`}>{r.reporter_name}</Link> : 'a deleted user'}
        <span className="text-muted"> against </span>{r.target_username ? <Link className="font-medium hover:underline" to={`/u/${r.target_username}`}>{targetName}</Link> : targetName}
        {ts && <> <StatusBadge status={ts} /></>}
      </p>
      {r.target_open_reports > 1 && <p className="text-sm text-danger">{r.target_open_reports} open reports against this person.</p>}
      {r.details && <p className="whitespace-pre-wrap break-words rounded-md bg-surface-2 p-3 text-sm">{r.details}</p>}
      {r.evidence.length > 0 && (<>
        <button className="text-sm text-brand hover:underline" aria-expanded={showEvidence} onClick={() => setShowEvidence(!showEvidence)}>{showEvidence ? 'Hide' : 'Show'} the last {r.evidence.length} messages</button>
        {showEvidence && <ul className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-surface-2 p-3 text-sm">{r.evidence.map((m) => (
          <li key={m.id}><span className="font-semibold">{who(m.sender_id)}</span> <span className="text-xs text-muted">{formatTime(m.created_at)}</span><p className="whitespace-pre-wrap break-words">{m.body}</p></li>))}</ul>}</>)}
      {error && <p className="text-sm text-danger">{error}</p>}
      {open && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={busy} onClick={dismiss}>Dismiss report</Button>
          {r.target_id && ts === 'active' && <Button size="sm" variant="secondary" onClick={() => onAct(r.target_id!, targetName, 'suspended', r.id)}>Suspend</Button>}
          {r.target_id && ts && ts !== 'banned' && <Button size="sm" variant="danger" onClick={() => onAct(r.target_id!, targetName, 'banned', r.id)}>Ban</Button>}
          {r.target_id && ts && ts !== 'active' && <Button size="sm" onClick={() => onAct(r.target_id!, targetName, 'active', r.id)}>Reinstate</Button>}
        </div>)}
    </Card>
  );
}
