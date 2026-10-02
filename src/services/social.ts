import { rpc } from '@/lib/api';
export type FollowStatus = 'pending' | 'accepted';
export interface MiniUser { id: string; username: string; display_name: string; avatar_url: string | null }
export const follow = (id: string) => rpc<FollowStatus>('follow_user', { p_target: id });
export const unfollow = (id: string) => rpc('unfollow_user', { p_target: id });
export const respondFollowRequest = (followerId: string, accept: boolean) => rpc('respond_follow_request', { p_follower: followerId, p_accept: accept });
export const listFollowRequests = () => rpc<(MiniUser & { follower_id: string; created_at: string })[]>('list_follow_requests');
export const listFollows = (userId: string, kind: 'followers' | 'following', offset = 0) => rpc<MiniUser[]>('list_follows', { p_user: userId, p_kind: kind, p_offset: offset });
export const blockUser = (id: string) => rpc('block_user', { p_target: id });
export const unblockUser = (id: string) => rpc('unblock_user', { p_target: id });
export const listBlocked = () => rpc<MiniUser[]>('list_blocked');
