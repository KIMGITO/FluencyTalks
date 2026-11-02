import { create } from 'zustand';
import { countUnreadNotifications, listNotifications, markNotificationsRead, deleteNotifications, subscribeToNotifications } from '@/services';
import { useAccountabilityStore } from '@/store/accountabilityStore';
import type { AppNotification } from '@/types/db';

let unsub: (() => void) | null = null;
interface S {
  items: AppNotification[]; unread: number; loaded: boolean;
  load: () => Promise<void>; markRead: (ids?: string[]) => Promise<void>;
  markAllRead: () => Promise<void>; remove: (id: string) => Promise<void>;
  start: (userId: string) => void; stop: () => void;
}
export const useNotificationStore = create<S>((set, get) => ({
  items: [], unread: 0, loaded: false,
  load: async () => { const [items, unread] = await Promise.all([listNotifications(), countUnreadNotifications()]); set({ items, unread: Number(unread), loaded: true }); },
  // The dot goes at once and comes back if the server said no.
  markRead: async (ids) => {
    const prev = get();
    const now = new Date().toISOString();
    const items = prev.items.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n));
    set({ items, unread: ids ? Math.max(0, prev.unread - prev.items.filter((n) => !n.read_at && ids.includes(n.id)).length) : 0 });
    try { await markNotificationsRead(ids); }
    catch (e) { set({ items: prev.items, unread: prev.unread }); throw e; }
  },
  markAllRead: async () => { await get().markRead(); },
  remove: async (id) => { await deleteNotifications([id]); await get().load(); },
  start: (userId) => { if (unsub) return; get().load().catch(() => {}); unsub = subscribeToNotifications(userId, () => { get().load().catch(() => {}); void useAccountabilityStore.getState().load(); }); },
  stop: () => { unsub?.(); unsub = null; set({ items: [], unread: 0, loaded: false }); },
}));
