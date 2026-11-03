import { rpc } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/** `exempt`: this caller is staff and keeps working during a pause. `enforced` is only sent to staff. */
export interface AppStatus { paused: boolean; message: string | null; since: string | null; exempt: boolean; enforced?: boolean }

export const getAppStatus = () => rpc<AppStatus>('get_app_status');
export const adminSetAppPaused = (paused: boolean, reason: string, message?: string) =>
  rpc<AppStatus>('admin_set_app_paused', { p_paused: paused, p_reason: reason, p_message: message || null });

export function subscribeToAppStatus(onChange: () => void) {
  const ch = supabase.channel('app-status')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_status' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
