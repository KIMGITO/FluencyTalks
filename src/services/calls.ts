import { supabase } from '@/lib/supabase';
import { ApiError, rpc } from '@/lib/api';
import { OOPS } from '@/lib/errors';
import { REFUSALS } from '@/lib/refusals';
import type { CallInfo, CallStatus } from '@/lib/callState';

export interface LiveCall {
  call_id: string; status: CallStatus; my_invitation: string; my_presence: string; ring_expires_at: string; initiated_by: string | null;
  other_id: string | null; other_name: string | null; other_username: string | null; other_avatar: string | null;
}
export interface CallHistoryRow {
  call_id: string; status: CallStatus; end_reason: string | null; created_at: string; started_at: string | null; ended_at: string | null;
  outgoing: boolean; my_invitation: string; attended: boolean; participant_count: number;
  other_id: string | null; other_name: string | null; other_username: string | null; other_avatar: string | null;
}

/** Name and photo of the person about to be called; the public columns only, through row-level security. */
export async function getCallPeer(userId: string) {
  const { data } = await supabase.from('profiles').select('display_name, username, avatar_url').eq('id', userId).maybeSingle();
  return data as { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}
export const startCall = (callee: string) => rpc<string>('start_call', { p_callee: callee });
export const respondCallInvite = (call: string, accept: boolean) => rpc('respond_call_invite', { p_call: call, p_accept: accept });
export const getCall = (call: string) => rpc<CallInfo>('get_call', { p_call: call });
export const reportCallConnected = (call: string) => rpc('report_call_connected', { p_call: call });
/** Tells the caller the call reached this device, so they see "Ringing" instead of "Trying to reach". */
export const reportCallRinging = (call: string) => rpc('report_call_ringing', { p_call: call });
export interface CallLogRow { call_id: string; status: CallStatus; end_reason: string | null; created_at: string; started_at: string | null; ended_at: string | null; outgoing: boolean; attended: boolean }
/** Finished calls with one person, newest first, for the chat with them. */
export const listCallsWith = (other: string, limit = 50) => rpc<CallLogRow[]>('list_calls_with', { p_other: other, p_limit: limit });
/** Removes a finished call from my chat and call history. The other person still sees it. */
export const hideCall = (call: string) => rpc('hide_call', { p_call: call });
export const listLiveCalls = () => rpc<LiveCall[]>('list_live_calls');
export const listCallHistory = (limit = 30, before?: string | null) => rpc<CallHistoryRow[]>('list_call_history', { p_limit: limit, p_before: before ?? null });

async function edge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const code = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new ApiError(code ?? 'failed', (code && REFUSALS[code]) || OOPS);
  }
  return data as T;
}

/** The media token is only ever held in memory for the connection; it is never stored. */
export const getCallToken = (call: string) => edge<{ token: string; url: string; expires_in: number; voice_only: boolean }>('call-token', { call_id: call });
/** Hang up (`leave`) or end for everyone (`end`). Either way the server closes the media room once the call is over. */
export const callControl = (call: string, action: 'leave' | 'end') => edge<{ ok: boolean; ended: boolean }>('call-control', { call_id: call, action });

/** Any change to the people in my calls. Row-level security limits it to calls I'm in. */
export function subscribeToMyCalls(onChange: () => void) {
  const ch = supabase.channel(`calls:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'call_participants' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
