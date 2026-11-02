import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, RowListSkeleton } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminAccountability, adminDecideAppeal, adminExemptDecision, adminLiftRestriction, adminSetPolicy, type AccountabilityPolicy, type AdminAccountability } from '@/services/review';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';

const FIELDS: { key: keyof AccountabilityPolicy; label: string }[] = [
  { key: 'first_reminder_hours', label: 'First reminder after (hours)' },
  { key: 'repeat_reminder_hours', label: 'Repeat reminders every (hours)' },
  { key: 'deadline_hours', label: 'Deadline (hours)' },
  { key: 'escalate_after_hours', label: 'Escalate after the deadline (hours)' },
  { key: 'restrict_after_overdue', label: 'Pause posting at this many overdue' },
  { key: 'restrict_notice_hours', label: 'Notice before that pause (hours)' },
  { key: 'extension_hours', label: 'One extension gives (hours)' },
  { key: 'max_extensions', label: 'Extensions per decision' },
];
type Dialog = { kind: 'grant' | 'deny' | 'lift' | 'exempt' | 'policy'; id: string } | null;

export function AdminDecisions() {
  const [data, setData] = useState<AdminAccountability | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Partial<AccountabilityPolicy>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const isAdmin = useProfileStore((s) => s.me?.role === 'admin');
  const load = () => adminAccountability().then((d) => { setData(d); setDraft({}); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => { void load(); }, []);
  if (failed && !data) return <ErrorState title="Couldn't load decisions" onRetry={() => void load()} />;
  if (!data) return <RowListSkeleton />;
  const policy = { ...data.policy, ...draft };
  const act = async (reason: string) => {
    const d = dialog!;
    if (d.kind === 'grant' || d.kind === 'deny') await adminDecideAppeal(d.id, d.kind === 'grant', reason);
    if (d.kind === 'lift') await adminLiftRestriction(d.id, reason);
    if (d.kind === 'exempt') await adminExemptDecision(d.id, reason);
    if (d.kind === 'policy') await adminSetPolicy(draft, reason);
    toast.success('Done. It is on the record.');
    await load();
  };
  const titles: Record<NonNullable<Dialog>['kind'], string> = { grant: 'Grant this appeal?', deny: 'Deny this appeal?', lift: 'Lift this restriction?', exempt: 'Exempt this decision?', policy: 'Save the new policy?' };
  const empty = !data.escalated.length && !data.appeals.length && !data.restrictions.length;
  return (
    <div className="space-y-4">
      {empty && <EmptyState title="Nothing needs you" text="Overdue decisions, appeals and restrictions land here." />}
      {data.appeals.length > 0 && (
        <Card className="space-y-2"><h2 className="font-semibold">Appeals</h2>
          {data.appeals.map((a) => (
            <div key={a.id} className="space-y-1 border-t border-border pt-2 text-sm">
              <p><b>{a.name ?? 'Someone'}</b> <span className="text-muted">· {formatTime(a.created_at)}</span></p>
              <p className="whitespace-pre-line">{a.message}</p>
              <div className="flex gap-2"><Button size="sm" onClick={() => setDialog({ kind: 'grant', id: a.id })}>Grant</Button><Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'deny', id: a.id })}>Deny</Button></div>
            </div>))}
        </Card>)}
      {data.escalated.length > 0 && (
        <Card className="space-y-2"><h2 className="font-semibold">Escalated decisions</h2>
          {data.escalated.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-sm">
              <div className="min-w-0 flex-1 basis-56"><p className="truncate font-semibold">“{e.phrase}”</p><p className="text-xs text-muted">{e.owner_name ?? 'Someone'} · was due {formatTime(e.due_at)}</p></div>
              <Link to={`/library/post/${e.post_id}?item=${e.item_id}`} className="font-semibold underline">Open</Link>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'exempt', id: e.id })}>Exempt</Button>
            </div>))}
        </Card>)}
      {data.restrictions.length > 0 && (
        <Card className="space-y-2"><h2 className="font-semibold">Active restrictions</h2>
          {data.restrictions.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-sm">
              <div className="min-w-0 flex-1 basis-56"><p className="font-semibold">{r.name ?? 'Someone'}</p><p className="text-xs text-muted">{r.reason} · {formatTime(r.created_at)}</p></div>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'lift', id: r.id })}>Lift</Button>
            </div>))}
        </Card>)}
      <Card className="space-y-3">
        <h2 className="font-semibold">Accountability policy</h2>
        {!isAdmin && <p className="text-xs text-muted">Only admins can change this.</p>}
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={!isAdmin} checked={!!policy.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> Reminders and restrictions are on</label>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => <Input key={f.key} type="number" min={0} label={f.label} disabled={!isAdmin} value={String(policy[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })} />)}
        </div>
        {isAdmin && <Button size="sm" disabled={!Object.keys(draft).length} onClick={() => setDialog({ kind: 'policy', id: '' })}>Save policy</Button>}
        {data.policy.last_sweep_at && <p className="text-xs text-muted">Last checked {formatTime(data.policy.last_sweep_at)}.</p>}
      </Card>
      <details className="ft-card ft-card-pad text-sm"><summary className="min-h-9 cursor-pointer font-semibold">Audit log ({data.audit.length})</summary>
        <ul className="mt-2 divide-y divide-border">{data.audit.map((a) => (
          <li key={a.id} className="py-2"><b>{a.actor_name ?? 'System'}</b> {a.action.replace(/_/g, ' ')}{a.target_name && ` · ${a.target_name}`} <span className="text-muted">· {formatTime(a.created_at)}</span><span className="block text-xs text-muted">{a.reason}</span></li>))}</ul>
      </details>
      <ConfirmDialog open={!!dialog} title={dialog ? titles[dialog.kind] : ''} confirmLabel="Confirm" reasonLabel="Reason (kept on the record)" reasonRequired onClose={() => setDialog(null)} onConfirm={act}>
        {dialog?.kind === 'grant' && 'Lifts the restriction and exempts the overdue decisions behind it, so they do not count against this person.'}
      </ConfirmDialog>
    </div>
  );
}
