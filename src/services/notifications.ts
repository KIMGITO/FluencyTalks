import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { AppNotification } from '@/types/db';

export const listNotifications = (limit = 30, before?: string | null, category?: string | null) =>
  rpc<AppNotification[]>('list_notifications', { p_limit: limit, p_before: before ?? null, p_category: category ?? null });
export const countUnreadNotifications = () => rpc<number>('count_unread_notifications');


export function subscribeToNotifications(userId: string, onNew: () => void) {
  const ch = supabase.channel(`notifications:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => onNew())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
