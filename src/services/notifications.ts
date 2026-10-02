import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { AppNotification } from '@/types/db';

export const listNotifications = (limit = 30) => rpc<AppNotification[]>('list_notifications', { p_limit: limit });
export const countUnreadNotifications = () => rpc<number>('count_unread_notifications');

/** Realtime, part 2 of 2 (the other is services/messaging.ts). Only tells the caller "something new arrived"; it then re-fetches the feed. */
export function subscribeToNotifications(userId: string, onNew: () => void) {
  const ch = supabase.channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => onNew())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
