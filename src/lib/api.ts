import { supabase } from './supabase';

/** Maps database error codes (raised in SQL functions) to messages safe to show users. */
const friendly: Record<string, string> = {
  not_authenticated: 'Please log in again.', account_restricted: 'Your account is restricted.',
  user_unavailable: 'This person is unavailable.', cannot_follow_self: "You can't follow yourself.",
  rate_limited: 'Slow down a little and try again soon.', awaiting_acceptance: 'Wait for them to accept your message request.',
  conversation_unavailable: 'This conversation is unavailable.', empty_message: 'Write something first.',
  username_taken: 'That username is taken.', forbidden: "You don't have access to that.",
};
export class ApiError extends Error { constructor(public code: string, message: string) { super(message); } }

/** Single gateway for all Postgres functions. Swap this file if the backend ever moves off Supabase. */
export async function rpc<T = void>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const code = error.code === '23505' ? 'username_taken' : Object.keys(friendly).find((c) => error.message.includes(c)) ?? 'unknown';
    throw new ApiError(code, friendly[code] ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}
