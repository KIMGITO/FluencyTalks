// What a call screen shows, worked out from the server's record of the call and the state of the media connection.
// No imports, so it can be unit-tested without a browser.

export type CallStatus = 'ringing' | 'active' | 'ended' | 'cancelled' | 'expired';
export interface CallParticipant {
  user_id: string; username: string | null; display_name: string | null; avatar_url: string | null;
  role: 'host' | 'participant'; invitation_status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  presence: 'invited' | 'joining' | 'joined' | 'left' | 'removed'; joined_at: string | null; left_at: string | null;
  /** When the call reached one of their devices, so the caller can be told it is ringing. */
  rang_at?: string | null;
}
export interface CallInfo {
  id: string; status: CallStatus; host_id: string | null; initiated_by: string | null; created_at: string; ring_expires_at: string;
  started_at: string | null; ended_at: string | null; end_reason: string | null; max_participants: number; participants: CallParticipant[];
}
/** The media connection, as the provider reports it. */
export type MediaState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';
export type CallPhase = 'loading' | 'incoming' | 'preview' | 'connecting' | 'ringing' | 'waiting' | 'active' | 'reconnecting' | 'ended' | 'failed';

export const isLive = (s: CallStatus | undefined) => s === 'ringing' || s === 'active';
export const me = (call: CallInfo | null, myId: string | undefined) => call?.participants.find((p) => p.user_id === myId) ?? null;
export const others = (call: CallInfo | null, myId: string | undefined) => (call?.participants ?? []).filter((p) => p.user_id !== myId);

/** @param remotes how many other people the media connection can see right now */
export function callPhase(call: CallInfo | null, myId: string | undefined, media: MediaState, remotes: number): CallPhase {
  if (!call) return 'loading';
  const mine = me(call, myId);
  if (!mine || !isLive(call.status)) return 'ended';
  if (mine.invitation_status === 'pending') return 'incoming';
  if (mine.invitation_status !== 'accepted' || mine.presence === 'removed') return 'ended';
  if (media === 'failed') return 'failed';
  if (media === 'reconnecting') return 'reconnecting';
  if (media === 'connecting') return 'connecting';
  if (media === 'connected') {
    if (remotes > 0) return 'active';
    return call.status === 'ringing' ? 'ringing' : 'waiting';
  }
  return 'preview';
}

export interface EndedText { title: string; detail: string }

/** The words on the ended screen and in history. */
export function endedText(call: Pick<CallInfo, 'status' | 'end_reason' | 'started_at' | 'ended_at' | 'initiated_by'>, myId: string | undefined, otherName = 'They'): EndedText {
  const outgoing = call.initiated_by === myId;
  const length = call.started_at && call.ended_at ? formatDuration((Date.parse(call.ended_at) - Date.parse(call.started_at)) / 1000) : '';
  switch (call.end_reason) {
    case 'cancelled': return outgoing ? { title: 'Call cancelled', detail: '' } : { title: 'Missed call', detail: `${otherName} called you.` };
    case 'no_answer': return outgoing ? { title: 'No answer', detail: `${otherName} didn't pick up. Try again later, or send a message.` } : { title: 'Missed call', detail: `${otherName} called you.` };
    case 'declined': return outgoing ? { title: 'Call declined', detail: `${otherName} can't talk right now.` } : { title: 'Call declined', detail: '' };
    case 'time_limit': return { title: 'Call ended', detail: `Calls end after 2 hours. ${length ? `It lasted ${length}.` : ''}`.trim() };
    default: return { title: 'Call ended', detail: length ? `It lasted ${length}.` : '' };
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** A camera or microphone failure, in words that say what to do next. */
export function deviceErrorText(error: unknown, device: 'camera' | 'microphone'): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    return `Your browser blocked the ${device}. Allow it in the address bar's site settings, then try again.`;
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
    return `No ${device} was found. Connect one, or carry on without it.`;
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
    return `The ${device} is being used by another app. Close it there, then try again.`;
  return `The ${device} couldn't start. Try again, or carry on without it.`;
}
