import { supabase } from './supabase';

/** Maps database error codes (raised in SQL functions) to messages safe to show users. */
const friendly: Record<string, string> = {
  not_authenticated: 'Please log in again.', account_restricted: 'Your account is restricted.',
  user_unavailable: 'This person is unavailable.',
  rate_limited: 'Slow down a little and try again soon.', awaiting_acceptance: 'Wait for them to accept your message request.',
  conversation_unavailable: 'This conversation is unavailable.', empty_message: 'Write something first.',
  username_taken: 'That username is taken.',
  language_required: 'Choose the language you speak natively.', language_same: 'Your native and learning languages must be different.',
  language_unsupported: 'That language is not available yet.', invalid_level: 'Choose a level from A1 to C2.',
  insufficient_points: 'You need 50 points to ask the community.', too_many_bounties: 'You can have 3 open bounties at a time.',
  bounty_unavailable: 'That bounty is no longer open.', not_qualified_to_correct: 'Corrections come from native speakers or learners at B1 or above in that language.',
  already_answered: 'You already answered this one.', language_not_yours: 'Choose one of your own languages.',
  no_change: 'Your answer is the same as the original.', bounty_needs_language: 'Choose the language this message is written in.',
  cannot_correct_self: "You can't correct your own message.",
  language_change_cooldown: 'You changed languages recently. You can change them again after 30 days.', forbidden: "You don't have access to that.",
  not_contribution_eligible: 'You need a native language or a B1+ learning level set in your profile to contribute.',
  empty_phrase: 'Phrase cannot be empty.',
};
export class ApiError extends Error { constructor(public code: string, message: string) { super(message); } }

/** Single gateway for all Postgres functions. Swap this file if the backend ever moves off Supabase. */
export async function rpc<T = void>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (import.meta.env.DEV) console.warn('API error', fn, error.message, error.hint ?? '');   // dev only; never log arguments
    const code = error.code === '23505' ? 'username_taken' : Object.keys(friendly).find((c) => error.message.includes(c)) ?? 'unknown';
    throw new ApiError(code, friendly[code] ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}
