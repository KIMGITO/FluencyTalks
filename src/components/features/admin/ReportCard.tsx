import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Ban, ChevronDown, CirclePause, FileText, Flag, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Avatar, Button, Card, ConfirmDialog } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { ActionMenu, Chip, IconTile, type MenuAction } from './AdminKit';
import { useAction } from '@/hooks/useAction';
import { REPORT_REASONS } from '@/lib/constants';
import { formatTime, timeAgo } from '@/lib/format';
import { adminDismissReport, adminRemovePost } from '@/services';
import { refreshAdminCounts } from '@/store/adminStore';
import { toast } from '@/store/toastStore';
import type { AdminReport, AccountStatus } from '@/types/db';

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

const Person = ({ role, name, username }: { role: string; name: string; username: string | null }) => {
  const body = <><Avatar name={name} size="sm" /><span className="min-w-0"><span className="block text-xs text-muted">{role}</span><span className="block truncate text-sm font-semibold">{name}</span></span></>;
  return username ? <Link to={`/admin/people/${username}`} className="flex min-w-0 items-center gap-2 hover:underline">{body}</Link> : <span className="flex min-w-0 items-center gap-2">{body}</span>;
};

export function ReportCard({ report: r, onAct, onResolved }: { report: AdminReport; onAct: (userId: string, name: string, status: AccountStatus, reportId: string) => void; onResolved: () => void }) {
  const [showEvidence, setShowEvidence] = useState(false); const [confirmRemove, setConfirmRemove] = useState(false);
  const targetName = r.target_name ?? 'Deleted user'; const open = r.status === 'open'; const ts = r.target_status;
  const done = () => { void refreshAdminCounts(); onResolved(); };
  const dismiss = useAction(() => adminDismissReport(r.id), { success: 'Report dismissed.', onDone: done });
  // Post reports carry one snapshot of the post as evidence; post_id is cleared if the post was since deleted.
  const isPost = !!r.post_id || (!r.conversation_id && r.evidence.length === 1 && r.evidence[0].sender_id === r.target_id);
  const who = (id: string) => id === r.reporter_id ? 'Reporter' : id === r.target_id ? targetName : 'Other';
  const act = (status: AccountStatus) => onAct(r.target_id!, targetName, status, r.id);
  const moderation: (MenuAction & { icon: LucideIcon })[] = !r.target_id || !ts ? [] : [
    ...(ts === 'active' ? [{ label: 'Suspend', icon: CirclePause, onSelect: () => act('suspended') }] : []),
    ...(ts !== 'banned' ? [{ label: 'Ban', icon: Ban, danger: true, onSelect: () => act('banned') }] : []),
    ...(ts !== 'active' ? [{ label: 'Reinstate', icon: RotateCcw, onSelect: () => act('active') }] : []),
  ];
  return (
    <Card className={clsx('space-y-3', open && 'shadow-[inset_3px_0_0_rgb(var(--c-accent))]')}>
      <div className="flex flex-wrap items-center gap-2.5">
        <IconTile icon={isPost ? FileText : Flag} tone={open ? 'accent' : 'muted'} small />
        <h3 className="min-w-0 flex-1 basis-[10rem] font-display text-xl font-medium leading-tight">{reasonLabel(r.reason)}</h3>
        {isPost && <Chip tone="sun">Post</Chip>}
        {!open && <Chip tone={r.status === 'actioned' ? 'success' : 'muted'}><span className="capitalize">{r.status}</span></Chip>}
        <span title={formatTime(r.created_at)} className="text-xs text-muted">{timeAgo(r.created_at)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {r.reporter_username ? <Person role="Reported by" name={r.reporter_name ?? r.reporter_username} username={r.reporter_username} /> : <Person role="Reported by" name="A deleted user" username={null} />}
        <Person role="Against" name={targetName} username={r.target_username} />
        {ts && <StatusBadge status={ts} />}
      </div>
      {r.target_open_reports > 1 && <p><Chip tone="danger" icon={TriangleAlert}>{r.target_open_reports} open reports against this person</Chip></p>}
      {r.details && <blockquote className="ft-selectable whitespace-pre-wrap break-words border-l-[3px] border-accent bg-surface-2 p-3 text-sm">{r.details}</blockquote>}
      {r.evidence.length > 0 && (<>
        <button type="button" className="flex items-center gap-1 text-sm font-bold text-ink underline-offset-2 hover:underline" aria-expanded={showEvidence} onClick={() => setShowEvidence(!showEvidence)}><ChevronDown size={16} aria-hidden className={clsx('transition-transform', showEvidence && 'rotate-180')} />{showEvidence ? 'Hide' : 'Show'} {isPost ? 'the reported post' : `the last ${r.evidence.length} messages`}</button>
        {showEvidence && <ul className="ft-selectable max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3 pl-5">{r.evidence.map((m) => {
          const mine = m.sender_id === r.reporter_id;
          return (
            <li key={m.id} className={clsx('flex flex-col', mine ? 'items-end pr-2' : 'items-start')}>
              <span className="mb-0.5 text-xs text-muted"><b>{who(m.sender_id)}</b> · {formatTime(m.created_at)}</span>
              <p className={clsx('ft-bubble ft-tail whitespace-pre-wrap', mine ? 'ft-bubble-out' : 'ft-bubble-in')}>{m.body}</p>
            </li>);
        })}</ul>}</>)}
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="sm" variant="secondary" loading={dismiss.busy} onClick={() => void dismiss.run()}>Dismiss report</Button>
          {r.post_id && <Button size="sm" variant="danger" disabled={dismiss.busy} onClick={() => setConfirmRemove(true)}>Remove post</Button>}
          <ActionMenu label={`Moderate ${targetName}`} text="Moderate" actions={moderation} />
        </div>)}
      <ConfirmDialog open={confirmRemove} danger title="Remove this post for everyone?" confirmLabel="Remove post" onClose={() => setConfirmRemove(false)}
        onConfirm={async () => { await adminRemovePost(r.post_id!, r.id); toast.success('Post removed.'); done(); }}>
        It disappears from the library and this report closes as actioned.
      </ConfirmDialog>
    </Card>
  );
}
