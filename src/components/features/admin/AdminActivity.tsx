import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Bot, CirclePause, History, RotateCcw, XCircle, type LucideIcon } from 'lucide-react';
import { Card, EmptyState, ErrorState, RowListSkeleton, Select } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { formatTime, timeAgo } from '@/lib/format';
import { adminRecentActions } from '@/services';
import type { AdminAction } from '@/types/db';
import { IconTile, RefreshButton, Toolbar, type Tone } from './AdminKit';

type Kind = AdminAction['action'];
const verbs: Record<Kind, string> = { suspend: 'suspended', ban: 'banned', reinstate: 'reinstated', dismiss_report: 'dismissed a report', auto_suspend: 'was auto-suspended after repeated reports' };
const LOOK: Record<Kind, { icon: LucideIcon; tone: Tone; label: string }> = {
  suspend: { icon: CirclePause, tone: 'sun', label: 'Suspensions' }, ban: { icon: Ban, tone: 'danger', label: 'Bans' }, reinstate: { icon: RotateCcw, tone: 'success', label: 'Reinstatements' },
  dismiss_report: { icon: XCircle, tone: 'muted', label: 'Dismissed reports' }, auto_suspend: { icon: Bot, tone: 'accent', label: 'Automatic suspensions' },
};
const dayOf = (iso: string) => {
  const d = new Date(iso); const today = new Date(); const yesterday = new Date(Date.now() - 864e5);
  return d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === yesterday.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { month: 'long', day: 'numeric' });
};

const Who = ({ a }: { a: AdminAction }) => {
  const target = a.target_username ? <Link to={`/admin/people/${a.target_username}`} className="font-bold hover:underline">{a.target_name ?? a.target_username}</Link> : <b>{a.target_name ?? 'a deleted user'}</b>;
  if (a.action === 'auto_suspend') return <>{target} {verbs[a.action]}</>;
  if (a.action === 'dismiss_report') return <><b>{a.admin_name ?? 'An admin'}</b> {verbs[a.action]}</>;
  return <><b>{a.admin_name ?? 'An admin'}</b> {verbs[a.action]} {target}</>;
};

export function AdminActivity() {
  const [items, setItems] = useState<AdminAction[] | null>(null); const [failed, setFailed] = useState(false); const [kind, setKind] = useState<Kind | 'all'>('all');
  const refresh = useAction(async () => { setItems(await adminRecentActions()); setFailed(false); }, { success: 'Up to date.' });
  useEffect(() => { adminRecentActions().then(setItems).catch(() => setFailed(true)); }, []);
  if (failed && !items) return <ErrorState title="Couldn't load the activity" onRetry={() => void refresh.run()} busy={refresh.busy} />;
  if (!items) return <RowListSkeleton label="Loading the activity" />;
  const shown = items.filter((a) => kind === 'all' || a.action === kind);
  const days = shown.reduce<{ day: string; items: AdminAction[] }[]>((out, a) => {
    const day = dayOf(a.created_at); const last = out[out.length - 1];
    if (last?.day === day) last.items.push(a); else out.push({ day, items: [a] });
    return out;
  }, []);
  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="min-w-0 flex-1 basis-[12rem] sm:max-w-[16rem]"><Select className="border-border" aria-label="Filter by kind" value={kind} onChange={(e) => setKind(e.target.value as Kind | 'all')}>
          <option value="all">Everything</option>
          {(Object.keys(LOOK) as Kind[]).map((k) => <option key={k} value={k}>{LOOK[k].label}</option>)}
        </Select></div>
        <RefreshButton busy={refresh.busy} onClick={() => void refresh.run()} />
      </Toolbar>
      {!shown.length ? <EmptyState icon={<IconTile icon={History} />} title={items.length ? 'Nothing of this kind' : 'No moderation activity yet'} text={items.length ? 'Pick another filter to see the rest.' : 'Suspensions, bans and dismissed reports will appear here.'} /> : days.map(({ day, items: rows }) => (
        <section key={day} className="space-y-2">
          <h2 className="ft-kicker ft-inset !font-sans"><span aria-hidden className="h-px w-5 bg-accent" />{day}</h2>
          <Card>
            <ol>
              {rows.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < rows.length - 1 && <span aria-hidden className="absolute bottom-0 left-4 top-8 w-px -translate-x-1/2 bg-border" />}
                  <IconTile icon={LOOK[a.action].icon} tone={LOOK[a.action].tone} small />
                  <div className="min-w-0 flex-1 text-sm">
                    <p><Who a={a} /></p>
                    {a.reason && a.action !== 'dismiss_report' && <p className="ft-selectable mt-0.5 break-words text-muted">{a.reason}</p>}
                    <p className="mt-0.5 text-xs text-muted" title={formatTime(a.created_at)}>{timeAgo(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ))}
    </div>
  );
}
