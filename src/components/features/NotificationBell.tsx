import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { useNotificationStore } from '@/store/notificationStore';
import type { AppNotification } from '@/types/db';

const verbs: Record<AppNotification['type'], string> = {
  follow: 'started following you', follow_request: 'wants to follow you', follow_accepted: 'accepted your follow request',
  message_request: 'sent you a message request', correction: 'suggested a correction to your message',
};
/** Where a notification leads when tapped. */
const destination = (n: AppNotification) => {
  if (n.type === 'follow_request') return '/home';   // follow requests are answered on Home
  if (n.type === 'message_request' || n.type === 'correction') return n.data.conversation_id ? `/messages/${n.data.conversation_id}` : '/messages';
  return n.actor_username ? `/u/${n.actor_username}` : '/home';
};

export function NotificationBell() {
  const { items, unread, loaded, markRead } = useNotificationStore(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const go = (n: AppNotification) => { setOpen(false); if (!n.read_at) markRead([n.id]).catch(() => {}); nav(destination(n)); };
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="relative"><Bell size={20} />{unread > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-danger px-1 text-center text-xs font-semibold text-on-brand">{unread > 9 ? '9+' : unread}</span>}</span>
      </Button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        {/* Mobile: fixed full-width panel under the topbar so it can never overflow
            the small viewport. Desktop: classic right-aligned dropdown. */}
        <div className="ft-card fixed left-2 right-2 top-[calc(var(--layout-topbarH)+0.5rem)] z-40 shadow-pop sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            {unread > 0 && <button className="text-sm text-brand hover:underline" onClick={() => markRead().catch(() => {})}>Mark all read</button>}
          </div>
          {!loaded ? <p className="p-4 text-sm text-muted">Loading…</p> : !items.length ? <p className="p-4 text-sm text-muted">You're all caught up.</p> : (
            <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto overscroll-contain sm:max-h-96">{items.map((n) => (
              <li key={n.id}><button onClick={() => go(n)} className={clsx('flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2', !n.read_at && 'bg-brand-soft/40')}>
                <Avatar name={n.actor_name ?? '?'} src={n.actor_avatar} size="sm" />
                <span className="min-w-0 flex-1 break-words text-sm"><b>{n.actor_name ?? 'Someone'}</b> {verbs[n.type]}<span className="block text-xs text-muted">{formatTime(n.created_at)}</span></span>
                {!n.read_at && <span aria-label="Unread" className="h-3 w-3 shrink-0 rounded-full bg-brand" />}
              </button></li>))}</ul>)}
        </div></>)}
    </div>
  );
}
