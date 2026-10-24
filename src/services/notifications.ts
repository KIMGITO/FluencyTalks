import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { AppNotification } from '@/types/db';

export const listNotifications = (limit = 30) => rpc<AppNotification[]>('list_notifications', { p_limit: limit });
export const countUnreadNotifications = () => rpc<number>('count_unread_notifications');


export function subscribeToNotifications(userId: string, onNew: () => void) {
  const ch = supabase.channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => onNew())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
