import { rpc } from '@/lib/api';
import type { UserLanguage } from '@/types/db';
export interface MiniUser { id: string; username: string; display_name: string; avatar_url: string | null; languages?: UserLanguage[] }
export const blockUser = (id: string) => rpc('block_user', { p_target: id });
export const unblockUser = (id: string) => rpc('unblock_user', { p_target: id });
export const listBlocked = () => rpc<MiniUser[]>('list_blocked');
