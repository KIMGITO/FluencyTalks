import { create } from 'zustand';
import { countUnreadNotifications, listNotifications, markNotificationsRead, subscribeToNotifications } from '@/services';
import type { AppNotification } from '@/types/db';

let unsub: (() => void) | null = null;
interface S {
  items: AppNotification[]; unread: number; loaded: boolean;
  load: () => Promise<void>; markRead: (ids?: string[]) => Promise<void>;
  start: (userId: string) => void; stop: () => void;
}
export const useNotificationStore = create<S>((set, get) => ({
  items: [], unread: 0, loaded: false,
  load: async () => { const [items, unread] = await Promise.all([listNotifications(), countUnreadNotifications()]); set({ items, unread: Number(unread), loaded: true }); },
  markRead: async (ids) => { await markNotificationsRead(ids); await get().load(); },   // no ids = mark everything read
  start: (userId) => { if (unsub) return; get().load().catch(() => {}); unsub = subscribeToNotifications(userId, () => get().load().catch(() => {})); },
  stop: () => { unsub?.(); unsub = null; set({ items: [], unread: 0, loaded: false }); },
}));
