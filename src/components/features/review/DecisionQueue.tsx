import clsx from 'clsx';
import { CircleAlert, Clock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, ConfirmDialog, PartialError } from '@/components/ui';
import { waited } from '@/lib/format';
import { appealRestriction, requestExtension, type OwedDecision } from '@/services/review';
import { useAccountabilityStore } from '@/store/accountabilityStore';
import { toast } from '@/store/toastStore';
import { dueLabel } from './ThreadItemRow';

/** A one-line pointer for the top of Home: visible until the decisions are actually made. */
export function DecisionBanner() {
  const data = useAccountabilityStore((s) => s.data);
  if (!data || (!data.items.length && !data.restriction)) return null;
  const overdue = data.items.filter((i) => i.overdue).length;
  return (
    <Link to="/notifications" className={clsx('ft-card mb-3 flex items-center gap-2.5 p-3 text-sm font-semibold transition-colors hover:bg-surface-2', overdue || data.restriction ? 'text-danger' : 'text-warning')}>
      <CircleAlert size={18} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        {data.restriction ? 'New posts are paused. ' : ''}
        {data.items.length} {data.items.length === 1 ? 'correction needs' : 'corrections need'} your decision{overdue > 0 && `, ${overdue} overdue`}
      </span>
      <span className="shrink-0 underline underline-offset-2">Review</span>
    </Link>
  );
}

/** Everything the signed-in person owes, with the policy spelled out and the ways to ask for time or appeal. */
export function DecisionQueue() {
  const { data, failed, load } = useAccountabilityStore();
  const [extending, setExtending] = useState<OwedDecision | null>(null);
  const [appealing, setAppealing] = useState(false);
  if (failed && !data) return <PartialError text="Couldn't load your open decisions." onRetry={() => void load()} />;
  if (!data) return null;
  const { items, record, restriction, policy } = data;
  if (!items.length && !restriction) return null;
  return (
    <section aria-label="Needs your decision" className="mb-4 space-y-2">
      {restriction && (
        <Card className="space-y-2 border-danger/40">
          <h2 className="flex items-center gap-1.5 font-semibold text-danger"><CircleAlert size={16} aria-hidden /> New posts are paused</h2>
          <p className="text-sm text-muted">{restriction.reason}. Everything else still works. Posting comes back by itself as soon as fewer than {policy.restrict_after_overdue} are overdue.</p>
          {restriction.appeal?.status === 'open'
            ? <p className="text-sm font-semibold text-ink">Your appeal is with the moderators.</p>
            : <>
                {restriction.appeal?.status === 'denied' && <p className="text-sm text-muted">Your last appeal wasn't granted{restriction.appeal.decision_note && `: “${restriction.appeal.decision_note}”`}.</p>}
                <Button size="sm" variant="secondary" onClick={() => setAppealing(true)}>Explain or appeal</Button>
              </>}
        </Card>
      )}
      {items.length > 0 && (
        <Card pad={false} className="divide-y divide-border">
          <h2 className="p-3 font-semibold text-ink">Needs your decision <span className="text-sm font-normal text-muted">· {items.length}</span></h2>
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-semibold text-ink">“{i.phrase}”</p>
                <p className="truncate text-xs text-muted">{i.author_name ?? 'Someone'} {i.kind === 'clarification' ? 'asked a question' : `proposed ${i.proposed_phrase ? `“${i.proposed_phrase}”` : 'a change'}`}</p>
                <p className={clsx('flex items-center gap-1 text-xs font-semibold', i.overdue ? 'text-danger' : 'text-warning')}><Clock size={12} aria-hidden /> {dueLabel(i.due_at)} · waiting {waited(i.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {i.extensions < policy.max_extensions && <Button size="sm" variant="ghost" onClick={() => setExtending(i)}>More time</Button>}
                <Link to={`/library/post/${i.post_id}?item=${i.item_id}`} className="ft-btn inline-flex min-h-9 items-center justify-center rounded-md border border-accent bg-accent px-3 text-sm font-bold text-deep">Decide</Link>
              </div>
            </div>
          ))}
        </Card>
      )}
      {record.decided > 0 && <p className="ft-inset text-xs text-muted">You've answered {record.on_time} of {record.decided} corrections on time.</p>}
      <details className="ft-inset text-xs text-muted">
        <summary className="min-h-9 cursor-pointer py-2 font-semibold">How this works</summary>
        <p>You have {Math.round(policy.deadline_hours / 24)} days to accept or decline a correction on your post. Opening it or being online doesn't count as an answer. We remind you after {Math.round(policy.first_reminder_hours / 24)} days. If you need longer, ask for more time ({Math.round(policy.extension_hours / 24)} days, {policy.max_extensions === 1 ? 'once' : `${policy.max_extensions} times`} per decision). New posts pause only when {policy.restrict_after_overdue} or more decisions are overdue after notice, and start again once they're answered. Moderators can step in on overdue ones, and you can always appeal.</p>
      </details>

      <ConfirmDialog open={!!extending} title="Ask for more time" confirmLabel="Ask for more time" reasonLabel="What's the reason?" reasonRequired
        onClose={() => setExtending(null)}
        onConfirm={async (reason) => { const due = await requestExtension(extending!.id, reason); toast.success(`New deadline: ${new Date(due).toLocaleDateString()}.`); await load(); }}>
        You'll get {Math.round(policy.extension_hours / 24)} more days to decide. The person waiting can see it was extended.
      </ConfirmDialog>
      <ConfirmDialog open={appealing} title="Explain or appeal" confirmLabel="Send to moderators" reasonLabel="What should they know?" reasonRequired
        onClose={() => setAppealing(false)}
        onConfirm={async (msg) => { await appealRestriction(restriction!.id, msg); toast.success('Sent. A moderator will look at it.'); await load(); }}>
        For example, if you were away, or the corrections weren't really yours to answer.
      </ConfirmDialog>
    </section>
  );
}
