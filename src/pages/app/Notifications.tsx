import clsx from 'clsx';
import { CheckCheck, Settings2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, ErrorState, NotificationSkeleton, PartialError, Spinner, Tabs } from '@/components/ui';
import { PushToggle } from '@/components/features/review/PushToggle';
import { DecisionQueue } from '@/components/features/review/DecisionQueue';
import { formatTime } from '@/lib/format';
import { CATEGORY_LABEL, hasActor, notificationLink, notificationVerb } from '@/lib/notificationText';
import { deleteNotifications, listNotifications } from '@/services';
import { setNotificationPrefs } from '@/services/review';
import { useInfiniteScroll } from '@/store/feedCache';
import { useNotificationStore } from '@/store/notificationStore';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';
import type { AppNotification, NotificationCategory } from '@/types/db';

type Filter = 'all' | NotificationCategory;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'corrections', label: 'Corrections' }, { key: 'decisions', label: 'Decisions' }, { key: 'reminders', label: 'Reminders' }, { key: 'system', label: 'System' },
];
const PAGE = 25;
const OPTIONAL: { key: string; label: string; hint: string }[] = [
  { key: 'corrections', label: 'Corrections and replies', hint: 'Someone challenges your correction, replies, or confirms your post.' },
  { key: 'decisions', label: 'Decisions', hint: 'Someone accepts or declines your correction.' },
  { key: 'system', label: 'Notices', hint: 'Levels, vouches and points.' },
];

const dayLabel = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

export default function Notifications() {
  const navigate = useNavigate();
  const { unread, markRead, markAllRead, items: live } = useNotificationStore();
  const me = useProfileStore((s) => s.me);
  const reloadMe = useProfileStore((s) => s.load);
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const request = useRef(0);

  const first = useCallback(async (quiet = false) => {
    const mine = ++request.current;
    if (!quiet) { setItems(null); setFailed(false); }
    try {
      const rows = await listNotifications(PAGE, null, filter === 'all' ? null : filter);
      if (mine !== request.current) return;   // a newer filter took over
      setItems((old) => {
        // A background refresh keeps the older pages already loaded.
        const tail = quiet && old ? old.filter((o) => !rows.some((r) => r.id === o.id) && rows.length && o.created_at < rows[rows.length - 1].created_at) : [];
        return [...rows, ...tail];
      });
      if (!quiet) setDone(rows.length < PAGE);
    } catch {
      if (mine === request.current && !quiet) setFailed(true);
    }
  }, [filter]);
  useEffect(() => { void first(); }, [first]);
  // New ones arrived (the store listens): bring them in without a flash.
  const newest = live[0]?.id;
  useEffect(() => { if (newest) void first(true); }, [newest, first]);

  const more = async () => {
    if (!items?.length || done || loadingMore) return;
    setLoadingMore(true); setMoreFailed(false);
    try {
      const rows = await listNotifications(PAGE, items[items.length - 1].created_at, filter === 'all' ? null : filter);
      setItems((old) => [...(old ?? []), ...rows.filter((r) => !(old ?? []).some((o) => o.id === r.id))]);
      setDone(rows.length < PAGE);
    } catch { setMoreFailed(true); } finally { setLoadingMore(false); }
  };
  const sentinel = useInfiniteScroll(more, !!items && !done && !moreFailed, items?.length ?? 0);

  const open = (n: AppNotification) => {
    if (!n.read_at) {
      setItems((old) => old?.map((o) => (o.id === n.id ? { ...o, read_at: new Date().toISOString() } : o)) ?? old);
      markRead([n.id]).catch(() => undefined);
    }
    navigate(notificationLink(n));
  };
  const toggleRead = async (n: AppNotification) => {
    if (n.read_at) return;
    const stamp = new Date().toISOString();
    setItems((old) => old?.map((o) => (o.id === n.id ? { ...o, read_at: stamp } : o)) ?? old);
    try { await markRead([n.id]); }
    catch (e) { setItems((old) => old?.map((o) => (o.id === n.id ? { ...o, read_at: null } : o)) ?? old); toast.error((e as Error).message); }
  };
  const remove = async (n: AppNotification) => {
    const before = items;
    setItems((old) => old?.filter((o) => o.id !== n.id) ?? old);
    try { await deleteNotifications([n.id]); void useNotificationStore.getState().load(); }
    catch (e) { setItems(before); toast.error((e as Error).message); }
  };
  const allRead = async () => {
    setMarkingAll(true);
    const before = items;
    const stamp = new Date().toISOString();
    setItems((old) => old?.map((o) => (o.read_at ? o : { ...o, read_at: stamp })) ?? old);
    try { await markAllRead(); toast.success('All marked as read.'); }
    catch (e) { setItems(before); toast.error((e as Error).message); }
    finally { setMarkingAll(false); }
  };
  const setPref = async (key: string, on: boolean) => {
    if (!me) return;
    try { await setNotificationPrefs({ ...(me.notification_prefs ?? {}), [key]: on }); await reloadMe(me.id); toast.success('Saved.'); }
    catch (e) { toast.error((e as Error).message); }
  };

  const groups: { label: string; rows: AppNotification[] }[] = [];
  (items ?? []).forEach((n) => {
    const label = dayLabel(n.created_at);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.rows.push(n); else groups.push({ label, rows: [n] });
  });

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

      {failed ? <ErrorState title="Couldn't load your notifications" onRetry={() => void first()} />
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
