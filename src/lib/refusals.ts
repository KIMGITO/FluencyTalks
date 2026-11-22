// What the database refuses on purpose, in words for people. No imports, so it can be tested without a browser or Supabase.

export const REFUSALS: Record<string, string> = {
  not_authenticated: 'Please log in again.', account_restricted: 'Your account is restricted.',
  user_unavailable: 'This person is unavailable.',
  app_paused: 'The app is paused right now. Please try again soon.', rate_limited: 'Slow down a little and try again soon.', awaiting_acceptance: 'Wait for them to accept your message request.',
  conversation_unavailable: 'This conversation is unavailable.', empty_message: 'Write something first.',
  call_unavailable: 'This call is no longer available.', cannot_call_self: "You can't call yourself.", already_in_call: 'You are already in a call. Hang up first.',
  user_busy: 'They are on another call. Try again later.', calls_disabled: 'Calls are unavailable right now. Please try again later.',
  username_taken: 'That username is taken.', invalid_input: 'Please check what you entered and try again.',
  language_required: 'Choose the language you speak natively.', language_same: 'Your native and learning languages must be different.',
  language_unsupported: 'That language is not available yet.', invalid_level: 'Choose a level from A1 to C2.',
  insufficient_points: 'You need 50 points to ask the community.', too_many_bounties: 'You can have 3 open bounties at a time.',
  bounty_unavailable: 'That bounty is no longer open.', not_qualified_to_correct: 'Corrections come from native speakers or learners who have passed B1 in that language.',
  no_learning_language: 'Add the language you are learning to your profile first.', path_complete: "You've passed every level, up to C2.",
  topic_not_at_level: 'Choose a topic from your current level.', cannot_connect_self: "You can't be your own partner.",
  call_not_ended: 'You can rate the call once it has ended.', call_not_connected: 'You can only rate a call you both joined.',
  partner_not_eligible: 'This person can’t rate this level: they need to be a native speaker, or to have passed a higher level.',
  partner_already_assessed: 'This person has already rated you at this level. Each level needs different people.',
  assessment_not_partner: 'Only the person you talked with can assess this call.', assessment_call_not_ended: 'You can assess once the call has ended.',
  assessment_too_short: 'The call was too short to count. Talk for at least 10 minutes together.', assessment_window_closed: 'The time to assess this call has passed.',
  assessment_already_assessed: 'You already rated them at this level.', assessment_not_eligible: 'You can’t assess this topic.', invalid_score: 'Give every criterion a score from 1 to 5.',
  birth_date_required: 'Add your date of birth to continue.', guardian_pending: 'A parent or guardian needs to agree before you can do this.',
  guardian_declined: 'Your parent or guardian didn’t agree, so your account is being deleted.', minor_rules_required: 'Please read and accept the rules about members under 16.', too_young: 'You need to be 12 or older to join The Fluency Talks.',
  invalid_birth_date: 'Please check your date of birth.', birth_date_locked: 'Your date of birth is already set. To correct it, write to support@thefluencytalks.com.',
  guardian_not_needed: 'You don’t need a guardian’s agreement.', guardian_email_is_yours: 'Use your parent or guardian’s email address, not your own.',
  invalid_relationship: 'Choose how this person is related to you.', guardian_name_required: 'Write the parent or guardian’s full name.', invalid_email: 'Please check the email address.',
  email_unavailable: 'We can’t send emails right now. Please try again later.', email_failed: 'The email could not be sent. Please check the address and try again.',
  guardian_link_invalid: 'This link is no longer active. If you refused or withdrew permission, the account has already been deleted.', guardian_link_expired: 'This link has expired. Ask your child to send a new request.',
  guardian_already_decided: 'You have already answered this request.', guardian_must_be_adult: 'Confirm that you are 18 or older and the child’s parent or legal guardian.',
  guardian_not_confirmed: 'There is no agreement to withdraw.', invalid_decision: 'Please try again.', invalid_consent_kind: 'Please try again.', unknown_consent_version: 'Please reload the page and try again.',
  owner_cannot_correct: "This is your own post. You can reply, and decide on corrections.", invalid_parent: "That can't be answered this way.", parent_closed: 'That proposal is already closed.',
  proposal_required: 'Write the replacement you are proposing.', explanation_required: 'Say what is wrong and why.',
  duplicate_correction: 'Someone has already suggested exactly this. You can agree with it instead.', already_decided: 'Someone already decided this. Showing the latest.', reason_required: 'Please give a reason.',
  thread_too_deep: 'This branch is as deep as it can go. Reply higher up.', text_too_long: 'That is a little too long.', cannot_review_own: "You can't review your own contribution.",
  posting_restricted: 'New teaching posts are paused until your overdue decisions are answered. Practice posts still work.', post_under_review: "People are discussing this text, so it can't be changed now. You can still edit the category, context and image.",
  sentence_required: 'Choose the sentence you want to fix.', empty_body: 'Write something first.', overlay_too_long: 'Text on an image has to stay short: 120 characters at most.', already_asked: 'You already asked about this one. You can accept or decline it now.',
  post_has_open_decisions: 'Answer the open corrections on this post before deleting it.', extension_limit: "You've already used the extension for this decision.", already_appealed: 'Your appeal is already with the moderators.',
  correction_unavailable: 'That correction is no longer available.', missing_client_key: 'Please try again.', invalid_kind: 'Please try again.',
  level_must_be_earned: 'Your level rises as you pass levels in topic calls. You can lower it here, but not raise it.',
  practice_limit: "You've shared 5 practice posts today. Nice work! Keep your text and post it tomorrow.", partner_limit: 'You can save up to 100 partners. Remove one first.',
  cannot_block_self: "You can't block yourself.", cannot_follow_self: "You can't follow yourself.", cannot_save_self: "You can't save your own post.", cannot_message_self: "You can't message yourself.",
  already_answered: 'You already answered this one.', language_not_yours: 'Choose one of your own languages.',
  no_change: 'Your answer is the same as the original.', bounty_needs_language: 'Choose the language this message is written in.',
  cannot_correct_self: "You can't correct your own message.",
  language_change_cooldown: 'You changed languages recently, so this has to wait a little longer.', forbidden: "You don't have access to that.",
  learning_language_required: 'Add the language you are learning to your profile first.', help_post_fix_only: 'This post only takes replies.', invalid_post_type: 'Please try again.',
  not_contribution_eligible: 'You can teach in your native language, or in your learning language once you have passed B1. Stories, questions and “Correct me” posts are open to everyone.',
  invalid_category: 'Choose a category for this post.', invalid_image: 'Choose an image from Unsplash.',
  empty_phrase: 'Phrase cannot be empty.',
  post_not_found: 'That post is no longer available.', call_not_found: 'That call is no longer in your history.', already_reported: 'You already reported this post. Our team is on it.',
  cannot_report_self: "You can't report your own post.", saved_limit: 'You can save up to 500 posts. Remove some first.',
  invalid_alignment: 'Choose left, center or right alignment.',
  blog_invalid_slug: 'The web address can only use lowercase letters, numbers and hyphens.', blog_slug_taken: 'Another post already uses that web address.',
  blog_slug_locked: "This post has been public, so its web address can't change.", blog_slug_required: 'Give the post a title or a web address first.',
  blog_changed: 'Someone else saved this post while you were editing. Reload the page to see their version.', blog_too_long: 'This post is too long to save.',
  blog_not_found: 'That post no longer exists.', blog_title_required: 'Add a title before publishing.', blog_description_required: 'Add a search description before publishing.',
  blog_summary_required: 'Add a summary before publishing.', blog_body_required: 'Write the post before publishing.',
  faq_invalid_section: 'Choose a section for this question.', faq_question_required: 'Write the question.', faq_answer_required: 'Write the answer.',
  faq_question_too_long: 'That question is too long. The limit is 200 characters.', faq_answer_too_long: 'That answer is too long. The limit is 2000 characters.',
  faq_question_taken: 'That question is already in the FAQ.', faq_not_found: 'That question no longer exists.',
  faq_changed: 'Someone else changed this question while you were editing. Close this and open it again to see their version.',
  invite_invalid: 'This invitation has expired or was already used. Ask for a new one.', invite_email_mismatch: 'This invitation was sent to a different email address. Log in with that one.',
};

/** Which refusal this is, or 'unknown' when the database failed in a way we didn't plan for. */
export function refusalCode(message: string, code?: string): string {
  // Any other duplicate is a bug, not a taken username.
  if (code === '23505' && message.includes('username')) return 'username_taken';
  return Object.keys(REFUSALS).find((c) => message.includes(c)) ?? 'unknown';
}

// Not failures: an expired login (the client renews it), and a lookup that found nothing.
const ROUTINE_CODES = ['PGRST116', 'PGRST301', 'PGRST303'];

/**
 * What staff should read about a failed request, or null when nothing went wrong on our side. Takes only the path,
 * never the query, and leaves out `details`: both can hold what someone typed.
 */
export function failureReport(path: string, status: number, body: { code?: string; message?: string }): string | null {
  const area = path.match(/^\/(rest|functions|storage)\/v1\/(.*)$/);
  if (!area) return null;
  if (area[1] === 'storage') return status >= 500 ? `Storage error: ${status}` : null;
  if (area[1] === 'functions') return status >= 500 ? `Edge function error in ${area[2]}: ${status}` : null;
  const { code = '', message = '' } = body;
  if (area[2] === 'rpc/log_client_error' || ROUTINE_CODES.includes(code) || refusalCode(message, code) !== 'unknown') return null;
  return `Database error in ${area[2].replace(/^rpc\//, '')}: ${code || status} ${message}`.trim();
}
