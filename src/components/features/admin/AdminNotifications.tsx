import { useState } from 'react';
import clsx from 'clsx';
import { CheckCheck, Clock, Flag, Scale, Settings2, ShieldAlert, Trash2, type LucideIcon } from 'lucide-react';
import { PushToggle } from '@/components/features/review/PushToggle';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, ErrorState, NotificationSkeleton, PartialError, Spinner, Tabs } from '@/components/ui';
import { useNotificationFeed } from '@/hooks/useNotificationFeed';
import { formatTime } from '@/lib/format';
import { CATEGORY_LABEL, notificationVerb } from '@/lib/notificationText';
import { useAdminStore } from '@/store/adminStore';
import type { NotificationType } from '@/types/db';
import { IconTile, StatTile, type Tone } from './AdminKit';

type Filter = 'all' | 'reports' | 'escalations' | 'security';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'reports', label: 'Reports' }, { key: 'escalations', label: 'Appeals and escalations' }, { key: 'security', label: 'Security' },
];
const EMPTY: Record<Filter, string> = {
  all: 'New reports, appeals, escalated decisions and security alerts will show up here.',
  reports: 'A new report from the community will show up here.',
  escalations: 'Appeals and decisions that have gone overdue will show up here.',
  security: 'Recovery code use and site pauses will show up here.',
};
const LOOK: Partial<Record<NotificationType, { icon: LucideIcon; tone: Tone }>> = {
  admin_report: { icon: Flag, tone: 'accent' }, admin_appeal: { icon: Scale, tone: 'sun' }, action_escalated: { icon: Clock, tone: 'danger' },
  admin_security: { icon: ShieldAlert, tone: 'danger' }, admin_site: { icon: ShieldAlert, tone: 'danger' },
};

/** Staff alerts. Learners have their own page, with their own tabs: the database gives each side only its own kind. */
export function AdminNotifications() {
  const [filter, setFilter] = useState<Filter>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const overview = useAdminStore((s) => s.overview);
  const feed = useNotificationFeed(filter === 'all' ? null : filter);
  return (
    <div className="space-y-4">
      <PageHeader title="Staff notifications" subtitle={feed.unread ? `${feed.unread} unread` : "You're all caught up"} />
      {overview && (
        <div className="grid grid-cols-3 gap-2 px-3 sm:gap-3 md:px-0">
          <StatTile label="Open reports" value={overview.reports_open} icon={Flag} tone="accent" to="/admin/reports" />
          <StatTile label="Appeals" value={overview.appeals_open} icon={Scale} tone="sun" to="/admin/decisions" />
          <StatTile label="Escalated" value={overview.decisions_escalated} icon={Clock} tone="danger" to="/admin/decisions" />
        </div>
      )}
      <div className="ft-inset flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" loading={feed.markingAll} disabled={!feed.unread} onClick={feed.allRead}><CheckCheck size={15} aria-hidden /> Mark all as read</Button>
        <Button size="sm" variant="ghost" aria-label="Notification settings" aria-expanded={showPrefs} onClick={() => setShowPrefs((s) => !s)}><Settings2 size={15} aria-hidden /></Button>
      </div>
      {showPrefs && <div className="ft-card ft-card-pad"><PushToggle /><p className="mt-2 text-xs text-muted">Staff alerts always arrive here. This only adds your phone or computer.</p></div>}
      <div className="ft-inset overflow-x-auto"><Tabs value={filter} onChange={setFilter} items={FILTERS} /></div>
      {feed.failed ? <ErrorState title="Couldn't load your notifications" onRetry={feed.retry} />
        : feed.items === null ? <NotificationSkeleton />
        : !feed.items.length ? <EmptyState title="Nothing here" text={EMPTY[filter]} />
        : (
          <div className="space-y-3">
            {feed.groups.map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h2 className="ft-kicker ft-inset mb-1.5">{g.label}</h2>
                <ul className="ft-card divide-y divide-border">
                  {g.rows.map((n) => {
                    const look = LOOK[n.type] ?? { icon: ShieldAlert, tone: 'muted' as Tone };
                    return (
                      <li key={n.id} className={clsx('flex items-start gap-2 p-2 sm:p-3', !n.read_at && 'bg-brand-soft/40')}>
                        <button type="button" onClick={() => feed.open(n)} className="flex min-w-0 flex-1 items-start gap-3 rounded-md p-1 text-left hover:bg-surface-2">
                          <IconTile icon={look.icon} tone={look.tone} small />
                          <span className="min-w-0 flex-1 break-words text-sm">
                            {notificationVerb(n)}
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                              {n.category && <span className="font-semibold">{CATEGORY_LABEL[n.category]}</span>}
                              {formatTime(n.created_at)}
                              {!n.read_at && <span className="sr-only">Unread</span>}
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center">
                          {!n.read_at
                            ? <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => void feed.toggleRead(n)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /></button>
                            : <span className="h-9 w-9" aria-hidden />}
                          <button type="button" aria-label="Delete notification" title="Delete" onClick={() => void feed.remove(n)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger"><Trash2 size={15} aria-hidden /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div ref={feed.sentinel} aria-hidden />
            {feed.loadingMore && <div className="flex justify-center p-3"><Spinner /></div>}
            {feed.moreFailed && <PartialError text="Couldn't load older notifications." onRetry={() => void feed.more()} />}
          </div>
        )}
    </div>
  );
}
