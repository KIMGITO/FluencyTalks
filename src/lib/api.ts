import { supabase } from './supabase';


const friendly: Record<string, string> = {
  not_authenticated: 'Please log in again.', account_restricted: 'Your account is restricted.',
  user_unavailable: 'This person is unavailable.',
  rate_limited: 'Slow down a little and try again soon.', awaiting_acceptance: 'Wait for them to accept your message request.',
  conversation_unavailable: 'This conversation is unavailable.', empty_message: 'Write something first.',
  username_taken: 'That username is taken.',
  language_required: 'Choose the language you speak natively.', language_same: 'Your native and learning languages must be different.',
  language_unsupported: 'That language is not available yet.', invalid_level: 'Choose a level from A1 to C2.',
  insufficient_points: 'You need 50 points to ask the community.', too_many_bounties: 'You can have 3 open bounties at a time.',
  bounty_unavailable: 'That bounty is no longer open.', not_qualified_to_correct: 'Corrections come from native speakers or learners verified at B1 or above in that language.',
  vouch_not_native: 'Only native speakers of that language can vouch.', vouch_self: "You can't vouch for yourself.", vouch_too_new: 'You can vouch after 7 days here.',
  vouch_low_ratings: "You can't vouch while most ratings of your corrections are not helpful.", vouch_not_enough_chat: 'Chat with them a bit more before you vouch.', vouch_limit: "You've used your 3 vouches for this month.",
  owner_cannot_correct: "This is your own post. You can reply, and decide on corrections.", invalid_parent: "That can't be answered this way.", parent_closed: 'That proposal is already closed.',
  proposal_required: 'Write the replacement you are proposing.', explanation_required: 'Say what is wrong and why.',
  duplicate_correction: "You've already proposed exactly this.", already_decided: 'Someone already decided this. Showing the latest.', reason_required: 'Please give a reason.',
  thread_too_deep: 'This branch is as deep as it can go. Reply higher up.', text_too_long: 'That is a little too long.', cannot_review_own: "You can't review your own contribution.",
  posting_restricted: 'New posts are paused until your overdue decisions are answered.', post_under_review: "People are discussing this text, so it can't be changed now. You can still edit the category, context and image.",
  post_has_open_decisions: 'Answer the open corrections on this post before deleting it.', extension_limit: "You've already used the extension for this decision.", already_appealed: 'Your appeal is already with the moderators.',
  correction_unavailable: 'That correction is no longer available.', missing_client_key: 'Please try again.', invalid_kind: 'Please try again.',
  level_must_be_earned: 'Your level rises as you practise. You can lower it here, but not raise it.',
  already_answered: 'You already answered this one.', language_not_yours: 'Choose one of your own languages.',
  no_change: 'Your answer is the same as the original.', bounty_needs_language: 'Choose the language this message is written in.',
  cannot_correct_self: "You can't correct your own message.",
  language_change_cooldown: 'You changed languages recently. You can change them again after 30 days.', forbidden: "You don't have access to that.",
  not_contribution_eligible: 'You can post in your native language, or in your learning language once verified at B1.',
  invalid_category: 'Choose a category for this post.', invalid_image: 'Choose an image from Unsplash.',
  empty_phrase: 'Phrase cannot be empty.',
  post_not_found: 'That post is no longer available.', already_reported: 'You already reported this post. Our team is on it.',
  cannot_report_self: "You can't report your own post.", saved_limit: 'You can save up to 500 posts. Remove some first.',
  invalid_alignment: 'Choose left, center or right alignment.',
};
export class ApiError extends Error { constructor(public code: string, message: string) { super(message); } }


export async function rpc<T = void>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (import.meta.env.DEV) console.warn('API error', fn, error.message, error.hint ?? '');   
    const code = error.code === '23505' ? 'username_taken' : Object.keys(friendly).find((c) => error.message.includes(c)) ?? 'unknown';
    throw new ApiError(code, friendly[code] ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}
