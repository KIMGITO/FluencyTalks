import { rpc } from '@/lib/api';

export interface Seen { user_id: string; online: boolean; last_seen_at: string | null }

export const touchPresence = () => rpc('touch_presence');
export const getPresence = (ids: string[]) => rpc<Seen[]>('presence_of', { p_users: ids });
export const setShowActivity = (show: boolean) => rpc('set_show_activity', { p_show: show });
