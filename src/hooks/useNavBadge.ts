import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUnreadCount } from './useUnreadCount';
import { badgeTabFor, useBadgeStore } from '@/store/badgeStore';

const REFRESH_MS = 60_000;

/** The count on a nav item: unread chats for Messages, the server's "new since you looked" for the rest. */
export function useNavBadge(to: string): number {
  const unread = useUnreadCount();
  const tab = badgeTabFor(to);
  const count = useBadgeStore((s) => (tab ? s.counts[tab] ?? 0 : 0));
  return to === '/messages' ? unread : count;
}

/** Once, in the app shell: keeps the counts fresh and clears the tab you are on. */
export function useNavBadgeSync() {
  const { pathname } = useLocation();
  const { load, seen } = useBadgeStore();
  useEffect(() => {
    const tab = badgeTabFor(pathname);
    if (tab) seen(tab);
    void load();
  }, [pathname]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', tick);
    const t = setInterval(tick, REFRESH_MS);
    return () => { document.removeEventListener('visibilitychange', tick); clearInterval(t); };
  }, []);
}
