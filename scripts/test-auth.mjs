// Tests for the password-reset / auth helpers. Run: node --experimental-strip-types scripts/test-auth.mjs
import assert from 'node:assert/strict';
import { parseLanding, friendlyAuthError, sessionClaims, isFullStaffLogin, staffPathFor } from '../src/lib/authHelpers.ts';

// A working recovery link (implicit flow): tokens and type=recovery in the hash.
assert.deepEqual(parseLanding('#access_token=abc&refresh_token=x&expires_in=3600&type=recovery', '', '/reset-password'), { recovery: true, linkError: null });
// PKCE flow: ?code= on the reset page.
assert.equal(parseLanding('', '?code=123', '/reset-password').recovery, true);
// A ?code= on some other page is an OAuth login, not a password reset.
assert.equal(parseLanding('', '?code=123', '/home').recovery, false);
// Expired / already used link: Supabase reports it in the hash. Must NOT look like a recovery.
const bad = parseLanding('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', '', '/reset-password');
assert.equal(bad.recovery, false);
assert.equal(bad.linkError, 'Email link is invalid or has expired');
// A plain visit.
assert.deepEqual(parseLanding('', '', '/reset-password'), { recovery: false, linkError: null });
assert.deepEqual(parseLanding('', '', '/login'), { recovery: false, linkError: null });

// Errors people can act on.
assert.match(friendlyAuthError('Auth session missing!'), /expired or was already used/);
assert.match(friendlyAuthError('New password should be different from the old password.'), /not used before/);
assert.match(friendlyAuthError('Password should be at least 8 characters.'), /8 characters/);
assert.match(friendlyAuthError('email rate limit exceeded'), /Too many attempts/);
assert.match(friendlyAuthError('For security purposes, you can only request this after 52 seconds.'), /Too many attempts/);
assert.equal(friendlyAuthError('Invalid login credentials'), 'Wrong email or password.');
assert.equal(friendlyAuthError('Something unexpected'), 'Something unexpected');
// Staff logins: password and code both, in any order; anything else is not enough.
const token = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const amr = (...methods) => methods.map((method) => ({ method, timestamp: 1 }));
assert.equal(isFullStaffLogin(sessionClaims(token({ aal: 'aal2', amr: amr('totp', 'password') }))), true);
assert.equal(isFullStaffLogin(sessionClaims(token({ aal: 'aal1', amr: amr('password') }))), false);
assert.equal(isFullStaffLogin(sessionClaims(token({ aal: 'aal2', amr: amr('totp', 'oauth') }))), false);
assert.equal(isFullStaffLogin(sessionClaims(token({ aal: 'aal2', amr: amr('totp', 'recovery') }))), false);
assert.equal(isFullStaffLogin(sessionClaims(token({ aal: 'aal2', amr: amr('totp', 'otp') }))), false);
assert.equal(isFullStaffLogin(sessionClaims('not-a-token')), false);
assert.equal(isFullStaffLogin(sessionClaims(null)), false);

assert.equal(staffPathFor('/home'), '/admin');
assert.equal(staffPathFor('/onboarding'), '/admin');
assert.equal(staffPathFor('/messages/abc'), '/admin');
assert.equal(staffPathFor('/u/sara'), '/admin/people/sara');
assert.equal(staffPathFor('/library/post/p1', '?item=i1'), '/admin/posts/p1?item=i1');
assert.equal(staffPathFor('/notifications'), '/admin/notifications');
console.log('auth helpers: all checks passed');
