import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
export const exportMyData = () => rpc<Record<string, unknown>>('export_my_data');
export const recordConsent = (kind: 'terms' | 'privacy' | 'age_18', version: string) => rpc('record_consent', { p_kind: kind, p_version: version });
export const markNotificationsRead = (ids?: string[]) => rpc('mark_notifications_read', { p_ids: ids ?? null });
export const deleteNotifications = (ids?: string[]) => rpc('delete_notifications', { p_ids: ids ?? null });
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw new Error('Could not delete your account. Please try again.');
}
