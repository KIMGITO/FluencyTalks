import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hasActor, notificationLink, notificationVerb } from '@/lib/notificationText';
import clsx from 'clsx';
import { Bell, Trash2 } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { useNotificationStore } from '@/store/notificationStore';
import type { AppNotification } from '@/types/db';

export function NotificationBell() {
  const { items, unread, loaded, markRead, markAllRead, remove } = useNotificationStore(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const go = (n: AppNotification) => { setOpen(false); if (!n.read_at) markRead([n.id]).catch(() => {}); nav(notificationLink(n)); };
  const del = (e: React.MouseEvent, n: AppNotification) => { e.stopPropagation(); remove(n.id).catch(() => {}); };
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} onClick={() => { if (window.matchMedia('(max-width: 767px)').matches) nav('/notifications'); else setOpen(!open); }}>
        <span className="relative"><Bell size={20} />{unread > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-sm bg-accent px-1 text-center text-xs font-bold text-deep">{unread > 9 ? '9+' : unread}</span>}</span>
      </Button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="ft-card fixed left-2 right-2 top-[calc(var(--layout-topbarH)+0.5rem)] z-40 shadow-pop sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            {items.length > 0 && <button className="text-sm text-brand hover:underline" onClick={() => markAllRead().catch(() => {})}>Mark all as read</button>}
          </div>
          {!loaded ? <p className="p-4 text-sm text-muted">Loading…</p> : !items.length ? <p className="p-4 text-sm text-muted">You're all caught up.</p> : (
            <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto overscroll-contain sm:max-h-96">{items.map((n) => (
              <li key={n.id} className={clsx('flex w-full items-center gap-3 p-3 hover:bg-surface-2', !n.read_at && 'bg-brand-soft/40')}>
                <button onClick={() => go(n)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Avatar name={n.actor_name ?? '?'} src={n.actor_avatar} size="sm" />
                  <span className="min-w-0 flex-1 break-words text-sm">{hasActor(n) && <b>{n.actor_name ?? 'Someone'} </b>}{notificationVerb(n)}<span className="block text-xs text-muted">{formatTime(n.created_at)}</span></span>
                  {!n.read_at && <span aria-label="Unread" className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
                </button>
                <button aria-label="Delete notification" title="Delete" onClick={(e) => del(e, n)} className="shrink-0 rounded-full p-1.5 text-muted hover:bg-surface hover:text-danger"><Trash2 size={15} /></button>
              </li>))}</ul>)}
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-3 text-center text-sm font-semibold text-ink hover:bg-surface-2">See all notifications</Link>
        </div></>)}
    </div>
  );
}
