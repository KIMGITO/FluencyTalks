import clsx from 'clsx';
import { CheckCheck, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, ErrorState, NotificationSkeleton, PartialError, Spinner, Tabs } from '@/components/ui';
import { PushToggle } from '@/components/features/review/PushToggle';
import { DecisionQueue } from '@/components/features/review/DecisionQueue';
import { useNotificationFeed } from '@/hooks/useNotificationFeed';
import { formatTime } from '@/lib/format';
import { CATEGORY_LABEL, hasActor, notificationVerb } from '@/lib/notificationText';
import { setNotificationPrefs } from '@/services/review';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';

type Filter = 'all' | 'corrections' | 'decisions' | 'reminders' | 'system';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'corrections', label: 'Corrections' }, { key: 'decisions', label: 'Decisions' }, { key: 'reminders', label: 'Reminders' }, { key: 'system', label: 'System' },
];
const OPTIONAL: { key: string; label: string; hint: string }[] = [
  { key: 'corrections', label: 'Corrections and replies', hint: 'Someone challenges your correction, replies, or confirms your post.' },
  { key: 'decisions', label: 'Decisions', hint: 'Someone accepts or declines your correction.' },
  { key: 'system', label: 'Notices', hint: 'Levels, vouches and points.' },
];

export default function Notifications() {
  const me = useProfileStore((s) => s.me);
  const reloadMe = useProfileStore((s) => s.load);
  const [filter, setFilter] = useState<Filter>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const { items, groups, unread, failed, moreFailed, loadingMore, markingAll, sentinel, retry, more, open, toggleRead, remove, allRead } = useNotificationFeed(filter === 'all' ? null : filter);

  const setPref = async (key: string, on: boolean) => {
    if (!me) return;
    try { await setNotificationPrefs({ ...(me.notification_prefs ?? {}), [key]: on }); await reloadMe(me.id); toast.success('Saved.'); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 md:pb-8">
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "You're all caught up"} />
      <DecisionQueue />
      <div className="ft-inset mb-2 flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" loading={markingAll} disabled={!unread} onClick={allRead}><CheckCheck size={15} aria-hidden /> Mark all as read</Button>
        <Button size="sm" variant="ghost" aria-label="Notification settings" aria-expanded={showPrefs} onClick={() => setShowPrefs((s) => !s)}><Settings2 size={15} aria-hidden /></Button>
      </div>
      {showPrefs && (
        <div className="ft-card ft-card-pad mb-3 space-y-2">
          <PushToggle />
          <p className="text-xs text-muted">Decisions you have to make and restrictions always reach you.</p>
          {OPTIONAL.map((o) => (
            <label key={o.key} className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={me?.notification_prefs?.[o.key] !== false} onChange={(e) => void setPref(o.key, e.target.checked)} />
              <span><span className="font-semibold">{o.label}</span><span className="block text-xs text-muted">{o.hint}</span></span>
            </label>
          ))}
        </div>
      )}
      <div className="ft-inset mb-3 overflow-x-auto"><Tabs value={filter} onChange={setFilter} items={FILTERS} /></div>

      {failed ? <ErrorState title="Couldn't load your notifications" onRetry={retry} />
        : items === null ? <NotificationSkeleton />
        : !items.length ? (
          <EmptyState title={filter === 'all' ? 'Nothing yet' : 'Nothing here'} text={filter === 'all' ? 'Corrections, decisions and replies about your posts will show up here.' : 'Try another filter, or look at All.'}
            action={filter !== 'all' ? <Button size="sm" variant="secondary" onClick={() => setFilter('all')}>Show all</Button> : undefined} />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h2 className="ft-kicker ft-inset mb-1.5">{g.label}</h2>
                <ul className="ft-card divide-y divide-border">
                  {g.rows.map((n) => (
                    <li key={n.id} className={clsx('flex items-start gap-2 p-2 sm:p-3', !n.read_at && 'bg-brand-soft/40')}>
                      <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 rounded-md p-1 text-left hover:bg-surface-2">
                        <Avatar name={n.actor_name ?? '!'} src={n.actor_avatar} size="sm" />
                        <span className="min-w-0 flex-1 break-words text-sm">
                          {hasActor(n) && <b>{n.actor_name ?? 'Someone'} </b>}{notificationVerb(n)}
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            {n.category && <span className="font-semibold">{CATEGORY_LABEL[n.category]}</span>}
                            {formatTime(n.created_at)}
                            {!n.read_at && <span className="sr-only">Unread</span>}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center">
                        {!n.read_at
                          ? <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => void toggleRead(n)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /></button>
                          : <span className="h-9 w-9" aria-hidden />}
                        <button type="button" aria-label="Delete notification" title="Delete" onClick={() => void remove(n)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger"><Trash2 size={15} aria-hidden /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div ref={sentinel} aria-hidden />
            {loadingMore && <div className="flex justify-center p-3"><Spinner /></div>}
            {moreFailed && <PartialError text="Couldn't load older notifications." onRetry={() => void more()} />}
          </div>
        )}
    </div>
  );
}
