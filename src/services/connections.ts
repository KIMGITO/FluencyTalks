import { rpc } from '@/lib/api';

export type ConnectionState = 'none' | 'outgoing' | 'incoming' | 'connected';
/** What I can see about someone right now. `in_call` is only ever true for people I'm allowed to call. */
export interface PersonStatus { user_id: string; connection: ConnectionState; online: boolean; in_call: boolean; can_call: boolean; good_calls: number }
export interface PersonLite { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
export interface HomePulse {
  online: number; live_calls: number; calls_today: number;
  talking_about: { no: number; title: string; band: string; category: string; language: string; started_at: string | null }[];
  popular_topics: { no: number; title: string; band: string; category: string; calls: number }[];
  languages: { id: string; natives: number; learners: number }[];
}

/** Returns 'connected' when they had already asked me, otherwise 'pending'. */
export const requestConnection = (user: string) => rpc<'pending' | 'connected'>('request_connection', { p_user: user });
export const respondConnection = (user: string, accept: boolean) => rpc('respond_connection', { p_user: user, p_accept: accept });
export const removeConnection = (user: string) => rpc('remove_connection', { p_user: user });
export const listConnectionRequests = () => rpc<(PersonLite & { created_at: string })[]>('list_connection_requests');
export const listConnections = () => rpc<(PersonLite & { accepted_at: string })[]>('list_connections', { p_limit: 200 });
export const getPersonStatus = (ids: string[]) => (ids.length ? rpc<PersonStatus[]>('person_status', { p_users: ids.slice(0, 100) }) : Promise.resolve([]));
export const getHomePulse = () => rpc<HomePulse>('home_pulse');
export const voteCall = (call: string, vote: 'good' | 'bad') => rpc('vote_call', { p_call: call, p_vote: vote });
export const myCallVote = (call: string) => rpc<'good' | 'bad' | null>('my_call_vote', { p_call: call });
