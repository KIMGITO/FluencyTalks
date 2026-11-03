import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, CircleCheck, Clock, PauseOctagon, Scale, ScrollText, SlidersHorizontal } from 'lucide-react';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, RowListSkeleton, buttonClass } from '@/components/ui';
import { formatTime, timeAgo } from '@/lib/format';
import { adminAccountability, adminDecideAppeal, adminExemptDecision, adminLiftRestriction, adminSetPolicy, type AccountabilityPolicy, type AdminAccountability } from '@/services/review';
import { refreshAdminCounts } from '@/store/adminStore';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';
import { Chip, IconTile, Panel, Switch } from './AdminKit';
import { checkWholeNumber } from '@/lib/validate';

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
type Dialog = { kind: 'grant' | 'deny' | 'lift' | 'exempt' | 'policy'; id: string; name?: string } | null;
const TITLES: Record<NonNullable<Dialog>['kind'], string> = { grant: 'Grant this appeal?', deny: 'Deny this appeal?', lift: 'Lift this restriction?', exempt: 'Exempt this decision?', policy: 'Save the new policy?' };
const DONE: Record<NonNullable<Dialog>['kind'], string> = { grant: 'Appeal granted. Their posting is back on.', deny: 'Appeal denied. It is on the record.', lift: 'Restriction lifted.', exempt: 'Decision exempted. It no longer counts against them.', policy: 'Policy saved.' };

export function AdminDecisions() {
  const [data, setData] = useState<AdminAccountability | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Partial<AccountabilityPolicy>>({});
  const [numbers, setNumbers] = useState<Record<string, string>>({});   // as typed, so a half-typed value can be shown and refused
  const [dialog, setDialog] = useState<Dialog>(null);
  const isAdmin = useProfileStore((s) => s.me?.role === 'admin');
  const load = () => adminAccountability().then((d) => { setData(d); setDraft({}); setNumbers({}); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => { void load(); }, []);
  if (failed && !data) return <ErrorState title="Couldn't load decisions" onRetry={() => void load()} />;
  if (!data) return <RowListSkeleton />;
  const policy = { ...data.policy, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const numbersWrong = Object.values(numbers).some((v) => checkWholeNumber(v, { label: 'This' }));
  const act = async (reason: string) => {
    const d = dialog!;
    if (d.kind === 'grant' || d.kind === 'deny') await adminDecideAppeal(d.id, d.kind === 'grant', reason);
    if (d.kind === 'lift') await adminLiftRestriction(d.id, reason);
    if (d.kind === 'exempt') await adminExemptDecision(d.id, reason);
    if (d.kind === 'policy') await adminSetPolicy(draft, reason);
    toast.success(DONE[d.kind]);
    void refreshAdminCounts();
    await load();
  };
  const empty = !data.escalated.length && !data.appeals.length && !data.restrictions.length;
  return (
    <div className="space-y-4">
      {empty && <EmptyState icon={<IconTile icon={CircleCheck} tone="success" />} title="Nothing needs you" text="Overdue decisions, appeals and restrictions land here." />}
      {data.appeals.length > 0 && (
        <Panel title="Appeals" icon={Scale} tone="sun" count={data.appeals.length} pad={false}>
          <div className="divide-y divide-border">
            {data.appeals.map((a) => (
              <div key={a.id} className="space-y-2 p-3 text-sm md:px-4">
                <div className="flex items-center gap-2.5"><Avatar name={a.name ?? 'Someone'} size="sm" /><p className="min-w-0 flex-1 truncate font-semibold">{a.name ?? 'Someone'}</p><span className="text-xs text-muted" title={formatTime(a.created_at)}>{timeAgo(a.created_at)}</span></div>
                <blockquote className="ft-selectable whitespace-pre-line break-words border-l-[3px] border-sun bg-surface-2 p-3">{a.message}</blockquote>
                <div className="flex gap-2"><Button size="sm" onClick={() => setDialog({ kind: 'grant', id: a.id })}>Grant</Button><Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'deny', id: a.id })}>Deny</Button></div>
              </div>))}
          </div>
        </Panel>)}
      {data.escalated.length > 0 && (
        <Panel title="Escalated decisions" icon={Clock} tone="danger" count={data.escalated.length} pad={false}>
          <div className="divide-y divide-border">
            {data.escalated.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2 p-3 text-sm md:px-4">
                <div className="min-w-0 flex-1 basis-[12rem]"><p className="truncate font-semibold">“{e.phrase}”</p><p className="text-xs text-muted">{e.owner_name ?? 'Someone'} · was due {formatTime(e.due_at)}</p></div>
                <Link to={`/admin/posts/${e.post_id}?item=${e.item_id}`} className={buttonClass('ghost', 'sm')}>Open <ArrowUpRight size={15} aria-hidden /></Link>
                <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'exempt', id: e.id })}>Exempt</Button>
              </div>))}
          </div>
        </Panel>)}
      {data.restrictions.length > 0 && (
        <Panel title="Active restrictions" icon={PauseOctagon} tone="accent" count={data.restrictions.length} pad={false}>
          <div className="divide-y divide-border">
            {data.restrictions.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm md:px-4">
                <Avatar name={r.name ?? 'Someone'} size="sm" />
                <div className="min-w-0 flex-1 basis-[10rem]"><p className="font-semibold">{r.name ?? 'Someone'}</p><p className="ft-selectable text-xs text-muted">{r.reason} · {formatTime(r.created_at)}</p></div>
                <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'lift', id: r.id })}>Lift</Button>
              </div>))}
          </div>
        </Panel>)}
      <Panel title="Accountability policy" icon={SlidersHorizontal} tone="brand" action={dirty ? <Chip tone="sun">Unsaved changes</Chip> : undefined} note={!isAdmin ? 'Only admins can change this.' : undefined}>
        <div className="space-y-4">
          <Switch label="Reminders and restrictions" hint={policy.enabled ? 'On: people are reminded, then restricted when overdue.' : 'Off: no reminders go out and nobody gets restricted.'} disabled={!isAdmin} checked={!!policy.enabled} onChange={(on) => setDraft({ ...draft, enabled: on })} />
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => <Input key={f.key} type="number" label={f.label} disabled={!isAdmin} error={numbers[f.key] === undefined ? undefined : checkWholeNumber(numbers[f.key], { label: 'This' }) || undefined} value={numbers[f.key] ?? String(policy[f.key] ?? '')}
              onChange={(e) => { const v = e.target.value.trim(); setNumbers({ ...numbers, [f.key]: v }); if (!checkWholeNumber(v, { label: 'This' })) setDraft({ ...draft, [f.key]: Number(v) }); }} />)}
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={!dirty || numbersWrong} onClick={() => setDialog({ kind: 'policy', id: '' })}>Save policy</Button>
              {dirty && <Button size="sm" variant="ghost" onClick={() => { setDraft({}); setNumbers({}); toast.info('Changes discarded.'); }}>Discard</Button>}
            </div>
          )}
          {data.policy.last_sweep_at && <p className="text-xs text-muted">Last checked {formatTime(data.policy.last_sweep_at)}.</p>}
        </div>
      </Panel>
      <Card pad={false}>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-3 md:px-4 [&::-webkit-details-marker]:hidden">
            <IconTile icon={ScrollText} small />
            <span className="min-w-0 flex-1 font-display text-xl font-medium leading-tight">Audit log <span className="ml-1 font-sans text-sm font-bold tabular-nums text-muted">{data.audit.length}</span></span>
            <ChevronDown size={18} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-border border-t border-border text-sm">{data.audit.map((a) => (
            <li key={a.id} className="p-3 md:px-4"><b>{a.actor_name ?? 'System'}</b> {a.action.replace(/_/g, ' ')}{a.target_name && ` · ${a.target_name}`} <span className="text-muted">· {formatTime(a.created_at)}</span><span className="ft-selectable block text-xs text-muted">{a.reason}</span></li>))}</ul>
        </details>
      </Card>
      <ConfirmDialog open={!!dialog} title={dialog ? TITLES[dialog.kind] : ''} confirmLabel="Confirm" reasonLabel="Reason (kept on the record)" reasonRequired onClose={() => setDialog(null)} onConfirm={act}>
        {dialog?.kind === 'grant' && 'Lifts the restriction and exempts the overdue decisions behind it, so they do not count against this person.'}
      </ConfirmDialog>
    </div>
  );
}
