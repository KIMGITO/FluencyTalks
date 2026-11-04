// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { failureReport, REFUSALS, refusalCode } from '../../src/lib/refusals.ts';

// Raised by checks a screen always passes first, by staff tools with their own messages, or by the database protecting itself.
// If one ever fires, the person sees "Oops!" and staff see it in the logs, which is right for a bug.
const INTERNAL = new Set([
  'a sealed archive batch cannot be changed', 'a sealed archive batch cannot be deleted', 'already_staff', 'batch_not_open', 'bootstrap_not_open',
  'cannot_remove_last_factor', 'correction_already_decided', 'discussion_is_immutable', 'invalid_bounty_transition', 'invalid_email', 'invalid_reply', 'invalid_status', 'invalid_tab', 'invalid_tier',
  'mfa_is_for_staff', 'not_staff', 'not_the_reserved_account', 'protected_profile_column', 'recovery_locked', 'reserved_email', 'signup_not_allowed',
  'admin_audit_log is append-only', 'staff roles change only through an invitation. See docs/ADMIN_SETUP.md',
  'staff_account', 'super_admin_email_is_fixed', 'super_admin_exists', 'worm_copy_required', 'worm_lock_too_short',
]);

test('everything the database refuses has words for people', () => {
  const dir = 'supabase/migrations';
  const sql = readdirSync(dir).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
  const raised = new Set([...sql.matchAll(/raise exception '([^'%]+)'/g)].map((m) => m[1]));
  const missing = [...raised].filter((c) => !INTERNAL.has(c) && !REFUSALS[c]);
  assert.deepEqual(missing, []);
});

test('a duplicate only means a taken username when it is about the username', () => {
  assert.equal(refusalCode('duplicate key value violates unique constraint "profiles_username_lower"', '23505'), 'username_taken');
  assert.equal(refusalCode('duplicate key value violates unique constraint "level_vouches_pkey"', '23505'), 'unknown');
});

test('planned refusals are not logged as failures', () => {
  assert.equal(failureReport('/rest/v1/rpc/send_message', 400, { code: 'P0001', message: 'awaiting_acceptance' }), null);
  assert.equal(failureReport('/rest/v1/rpc/send_message', 429, { code: 'PT429', message: 'rate_limited' }), null);
  assert.equal(failureReport('/rest/v1/profiles', 401, { code: 'PGRST303', message: 'JWT expired' }), null);
  assert.equal(failureReport('/rest/v1/posts', 406, { code: 'PGRST116', message: 'no rows' }), null);
});

test('real failures are logged with enough to act on', () => {
  assert.equal(failureReport('/rest/v1/rpc/home_feed', 404, { code: 'PGRST202', message: 'Could not find the function' }), 'Database error in home_feed: PGRST202 Could not find the function');
  assert.equal(failureReport('/rest/v1/messages', 403, { code: '42501', message: 'permission denied for table messages' }), 'Database error in messages: 42501 permission denied for table messages');
  assert.equal(failureReport('/rest/v1/messages', 500, {}), 'Database error in messages: 500');
});

test('logging can never report itself, and sign-ins are not database failures', () => {
  assert.equal(failureReport('/rest/v1/rpc/log_client_error', 500, { message: 'boom' }), null);
  assert.equal(failureReport('/auth/v1/token', 400, { message: 'Invalid login credentials' }), null);
});

test('only server faults count for functions and storage, and storage paths stay out of the log', () => {
  assert.equal(failureReport('/functions/v1/unsplash-proxy', 429, {}), null);
  assert.equal(failureReport('/functions/v1/delete-account', 500, {}), 'Edge function error in delete-account: 500');
  assert.equal(failureReport('/storage/v1/object/avatars/some-user/me.png', 400, {}), null);
  assert.equal(failureReport('/storage/v1/object/avatars/some-user/me.png', 503, {}), 'Storage error: 503');
});
