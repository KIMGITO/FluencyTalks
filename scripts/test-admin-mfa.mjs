#!/usr/bin/env node
// End-to-end check of staff accounts and MFA against the LOCAL Supabase stack: real Auth, real TOTP codes,
// the real edge function and the real mail catcher. It deletes and recreates its own test accounts, so it
// refuses to run on anything but localhost.
//
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')" && API_URL=$API_URL ANON_KEY=$ANON_KEY SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm run test:admin
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, MAILPIT_URL = 'http://127.0.0.1:54324' } = process.env;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) { console.error('Set API_URL, ANON_KEY and SERVICE_ROLE_KEY from `supabase status -o env`.'); process.exit(1); }
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(API_URL)) { console.error('This test only runs against a local stack.'); process.exit(1); }

const SUPER = 'superadmin@thefluencytalks.com'; const SUPER_PW = 'super-local-password-1';
const NEW_ADMIN = 'e2e-new-admin@test.local'; const NEW_PW = 'new-admin-password-1'; const NEW_PW_2 = 'new-admin-password-2';
const MEMBER = 'e2e-member@test.local'; const MEMBER_PW = 'member-password-1';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(API_URL, SERVICE_ROLE_KEY, options);
const client = () => createClient(API_URL, ANON_KEY, options);
let passed = 0;
const step = (name) => { passed += 1; console.log(`  ok  ${name}`); };

function totp(secret) {
  let bits = ''; for (const c of secret.replace(/=+$/, '')) bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', key).update(counter).digest(); const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function login(email, password) {
  const c = client(); const { error } = await c.auth.signInWithPassword({ email, password });
  assert.equal(error, null, `login ${email}: ${error?.message}`);
  return c;
}
async function enroll(c, name = 'Phone') {
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: name });
  assert.equal(error, null, `enroll: ${error?.message}`);
  assert.ok(data.totp.qr_code && data.totp.secret, 'a QR code and a secret come back');
  const { error: e2 } = await c.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  assert.equal(e2, null, `verify: ${e2?.message}`);
  return { id: data.id, secret: data.totp.secret };
}
const verify = async (c, factorId, secret) => { const { error } = await c.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) }); assert.equal(error, null, `verify: ${error?.message}`); };
const forbidden = async (c, fn, args) => { const { error } = await c.rpc(fn, args); assert.match(error?.message ?? 'no error', /forbidden/, `${fn} should be forbidden`); };
const allowed = async (c, fn, args) => { const { data, error } = await c.rpc(fn, args); assert.equal(error, null, `${fn}: ${error?.message}`); return data; };
async function edge(c, name, body) {
  const { data: { session } } = await c.auth.getSession();
  const res = await fetch(`${API_URL}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function edgeForbidden(c, body) {
  const r = await edge(c, 'admin-staff', body);
  assert.equal(r.status, 403, `${body.action}: ${JSON.stringify(r)}`);
}
async function findUser(email) {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === email);
}
const ownerScript = (args, input) => spawnSync('node', ['scripts/admin-accounts.mjs', ...args], { input, encoding: 'utf8', env: { ...process.env, SUPABASE_URL: API_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY } });

/** Follows the link in the newest email to this address, the way a browser does. */
async function openEmailLink(email, c) {
  let link;
  for (let i = 0; i < 20 && !link; i += 1) {
    const list = await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (list.messages?.[0]) {
      const msg = await (await fetch(`${MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`)).json();
      link = msg.Text.match(/https?:\/\/\S+verify\S+/)?.[0]?.replace(/&amp;/g, '&').replace(/\)$/, '');
    }
    if (!link) await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(link, `an email reached ${email}`);
  const res = await fetch(link, { redirect: 'manual' });
  const location = new URL(res.headers.get('location'));
  const hash = new URLSearchParams(location.hash.slice(1));
  assert.ok(hash.get('access_token'), `the link signs them in (${location.hash.slice(0, 80)})`);
  await c.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
  return location.searchParams.get('token');
}

for (const email of [SUPER, NEW_ADMIN, MEMBER]) { const u = await findUser(email); if (u) await service.auth.admin.deleteUser(u.id); }
await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });

console.log('The super admin comes in off the normal signup');
{
  const { error } = await client().auth.signUp({ email: SUPER, password: SUPER_PW });
  assert.ok(error, 'normal signup with the reserved address is refused');
  step('signup with the reserved address is refused');
  const r = ownerScript(['create-super-admin'], `${SUPER_PW}\n`);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(ownerScript(['create-super-admin'], `${SUPER_PW}\n`).status, 1, 'a second super admin is refused');
  step('the owner script creates it, once');
}

console.log('First login: password, QR code, code');
const sup = await login(SUPER, SUPER_PW);
let supFactor;
{
  const status = await allowed(sup, 'my_staff_status');
  assert.deepEqual([status.is_staff, status.tier, status.session_ok, status.used_password], [true, 'super', false, true]);
  await forbidden(sup, 'admin_overview');
  await forbidden(sup, 'admin_create_invitation', { p_email: 'x@test.local' });
  await edgeForbidden(sup, { action: 'probe' });
  step('with only a password: no database access, no edge function access');
  const { data } = await sup.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Wrong' });
  const { error } = await sup.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) === '000000' ? '111111' : '000000' });
  assert.ok(error, 'a wrong code does not verify');
  await forbidden(sup, 'admin_overview');
  await sup.auth.mfa.unenroll({ factorId: data.id });
  step('a wrong code enables nothing');
  await new Promise((r) => setTimeout(r, 1100));
  supFactor = await enroll(sup);
  assert.equal((await allowed(sup, 'my_staff_status')).session_ok, true);
  await allowed(sup, 'admin_overview');
  step('a valid code opens the database');
  for (let i = 0; i < 5; i += 1) {   // no false alarms: the health page must not say Down when nothing is
    const probe = await edge(sup, 'admin-staff', { action: 'probe' });
    assert.equal(probe.status, 200, JSON.stringify(probe));
    assert.ok(probe.body.services.every((s) => s.ok), JSON.stringify(probe.body.services));
  }
  const health = await allowed(sup, 'admin_system_health');
  assert.ok(health.database.size_bytes > 0 && health.database.connections > 0 && health.jobs.length >= 1, 'health has real numbers');
  await allowed(sup, 'admin_auth_events'); await allowed(sup, 'admin_logs'); await allowed(sup, 'admin_audit_feed');
  step('edge function, health and logs answer');
}

console.log('Every later login needs both');
{
  const again = await login(SUPER, SUPER_PW);
  const { data } = await again.auth.mfa.getAuthenticatorAssuranceLevel();
  assert.deepEqual([data.currentLevel, data.nextLevel], ['aal1', 'aal2']);
  await forbidden(again, 'admin_overview');
  await verify(again, supFactor.id, supFactor.secret);
  await allowed(again, 'admin_overview');
  step('the second login is aal1 until the code is given');
  const { error } = await again.auth.mfa.unenroll({ factorId: supFactor.id });
  assert.ok(error, 'the last factor cannot be removed');
  const backup = await enroll(again, 'Backup');
  const { data: f } = await again.auth.mfa.listFactors();
  assert.equal(f.totp.length, 2);
  const b = await login(SUPER, SUPER_PW);
  await verify(b, backup.id, backup.secret);
  await allowed(b, 'admin_overview');
  step('the backup authenticator works by itself');
  const { error: e2 } = await again.auth.mfa.unenroll({ factorId: backup.id });
  assert.equal(e2, null, 'a spare can go');
  step('the last factor stays; a spare can be removed');
  assert.equal((await edge(again, 'delete-account')).status, 403);
  step('delete-account refuses a staff account');
}

console.log('Learners are untouched and cannot get in');
let member;
{
  const m = client(); const { error } = await m.auth.signUp({ email: MEMBER, password: MEMBER_PW });
  assert.equal(error, null);
  member = await login(MEMBER, MEMBER_PW);
  const { data: { user } } = await member.auth.getUser();
  assert.deepEqual((await member.auth.mfa.getAuthenticatorAssuranceLevel()).data.nextLevel, 'aal1');
  step('an ordinary login stays password only');
  assert.ok((await member.auth.mfa.enroll({ factorType: 'totp' })).error, 'enrol refused');
  step('a learner cannot enrol a factor');
  const { error: selfPromote } = await member.from('profiles').update({ role: 'admin' }).eq('id', user.id);
  assert.ok(selfPromote, 'direct role update refused');
  assert.ok((await member.from('admin_accounts').insert({ user_id: user.id, tier: 'super' })).error, 'direct insert refused');
  await forbidden(member, 'admin_create_invitation', { p_email: 'x@test.local' });
  await edgeForbidden(member, { action: 'invite', email: 'x@test.local' });
  await edgeForbidden(member, { action: 'reset_mfa', user_id: user.id, reason: 'x' });
  assert.ok((await member.rpc('svc_open_super_bootstrap')).error, 'bootstrap is closed');
  step('no self-promotion through the table, the functions or the edge function');
}

console.log('Inviting');
let admin; let adminFactor; let adminId;
{
  const inv = await edge(sup, 'admin-staff', { action: 'invite', email: NEW_ADMIN, tier: 'admin' });
  assert.equal(inv.status, 200, JSON.stringify(inv));
  const c = client();
  const token = await openEmailLink(NEW_ADMIN, c);
  assert.ok(token, 'the token survives the redirect');
  const { error: wrong } = await member.rpc('accept_admin_invitation', { p_token: token });
  assert.match(wrong.message, /invite_email_mismatch/);
  step('the invitation arrives by email and only works for that address');
  assert.equal(await allowed(c, 'accept_admin_invitation', { p_token: token }), 'admin');
  assert.equal((await c.auth.updateUser({ password: NEW_PW })).error, null);
  await forbidden(c, 'admin_overview');
  await new Promise((r) => setTimeout(r, 1100));
  admin = await login(NEW_ADMIN, NEW_PW);
  await forbidden(admin, 'admin_overview');
  adminFactor = await enroll(admin);
  await allowed(admin, 'admin_overview');
  step('accept, set a password, log in, scan: only then do they have powers');
  const { data: { user } } = await admin.auth.getUser(); adminId = user.id;
  const { data: { user: supUser } } = await sup.auth.getUser();
  await forbidden(admin, 'admin_set_user_status', { p_user: supUser.id, p_status: 'suspended', p_reason: 'x' });
  await forbidden(admin, 'admin_create_invitation', { p_email: 'x@test.local' });
  await edgeForbidden(admin, { action: 'invite', email: 'x@test.local' });
  await edgeForbidden(admin, { action: 'reset_mfa', user_id: supUser.id, reason: 'x' });
  step('an invited admin cannot touch the super admin or invite others');
  const again = await edge(sup, 'admin-staff', { action: 'invite', email: MEMBER, tier: 'moderator' });
  assert.equal(again.status, 200, JSON.stringify(again));
  const m = client(); const t2 = await openEmailLink(MEMBER, m);
  assert.equal(await allowed(m, 'accept_admin_invitation', { p_token: t2 }), 'moderator');
  step('an existing member can be invited by email too');
}

console.log('Recovery');
{
  const codes = await allowed(admin, 'admin_generate_recovery_codes');
  assert.equal(codes.length, 10);
  const stale = admin;
  const c = await login(NEW_ADMIN, NEW_PW);
  assert.equal((await edge(c, 'admin-staff', { action: 'redeem_recovery', code: 'not-a-code' })).status, 400);
  await new Promise((r) => setTimeout(r, 1100));
  const ok = await edge(c, 'admin-staff', { action: 'redeem_recovery', code: codes[0] });
  assert.equal(ok.status, 200, JSON.stringify(ok));
  await forbidden(stale, 'admin_overview');
  step('a recovery code removes the factors and cuts off the old session at once');
  assert.equal((await edge(c, 'admin-staff', { action: 'redeem_recovery', code: codes[0] })).status, 400);
  await new Promise((r) => setTimeout(r, 1100));
  const fresh = await login(NEW_ADMIN, NEW_PW);
  adminFactor = await enroll(fresh);
  await allowed(fresh, 'admin_overview');
  step('they enrol a new authenticator and are back; the code is spent');

  // Forgot the password AND lost the phone: the mailbox and a recovery code are enough to start over.
  const { data: link } = await service.auth.admin.generateLink({ type: 'recovery', email: NEW_ADMIN });
  const res = await fetch(link.properties.action_link, { redirect: 'manual' });
  const hash = new URLSearchParams(new URL(res.headers.get('location')).hash.slice(1));
  const viaLink = client();
  await viaLink.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
  assert.ok((await viaLink.auth.updateUser({ password: NEW_PW_2 })).error, 'the password cannot change before the code');
  await new Promise((r) => setTimeout(r, 1100));
  const viaCode = await edge(viaLink, 'admin-staff', { action: 'redeem_recovery', code: codes[1] });
  assert.equal(viaCode.status, 200, JSON.stringify(viaCode));
  const setPw = await viaLink.auth.updateUser({ password: NEW_PW_2 });
  assert.equal(setPw.error, null, setPw.error?.message);
  await forbidden(viaLink, 'admin_overview');
  await new Promise((r) => setTimeout(r, 1100));
  const back = await login(NEW_ADMIN, NEW_PW_2);
  adminFactor = await enroll(back);
  await allowed(back, 'admin_overview');
  step('reset link + recovery code: new password, new authenticator, then a real login');

  const reset = await edge(sup, 'admin-staff', { action: 'reset_mfa', user_id: adminId, reason: 'lost phone, confirmed by call' });
  assert.equal(reset.status, 200, JSON.stringify(reset));
  await forbidden(back, 'admin_overview');
  assert.equal((await service.auth.admin.mfa.listFactors({ userId: adminId })).data.factors.length, 0);
  step('the super admin can reset an invited admin');

  const { data: { user: supUser } } = await sup.auth.getUser();
  await new Promise((r) => setTimeout(r, 1100));
  const glass = ownerScript(['reset-mfa', SUPER]);
  assert.equal(glass.status, 0, glass.stderr);
  await forbidden(sup, 'admin_overview');
  assert.equal((await service.auth.admin.mfa.listFactors({ userId: supUser.id })).data.factors.length, 0);
  step('the owner script is the last resort for the super admin');

  await new Promise((r) => setTimeout(r, 1100));
  const s2 = await login(SUPER, SUPER_PW);
  await enroll(s2);
  await allowed(s2, 'admin_overview');
  const pw = await login(SUPER, SUPER_PW);
  assert.match((await pw.auth.updateUser({ password: 'another-password-1' })).error?.message ?? '', /AAL2|aal2/i);
  step('a password cannot be changed with only a password');
  const removed = await edge(s2, 'admin-staff', { action: 'remove_staff', user_id: adminId, reason: 'left the team' });
  assert.equal(removed.status, 200, JSON.stringify(removed));
  const gone = await login(NEW_ADMIN, NEW_PW_2);
  assert.equal((await allowed(gone, 'my_staff_status')).is_staff, false);
  step('removing an admin ends their access and leaves them a learner');
  const audit = await allowed(s2, 'admin_audit_feed');
  for (const action of ['super_admin_created', 'staff_invited', 'invitation_accepted', 'mfa_factor_verified', 'recovery_code_used', 'mfa_reset', 'mfa_break_glass', 'staff_removed']) {
    assert.ok(audit.some((a) => a.action === action), `${action} is on the record`);
  }
  step('all of it is on the audit trail');
}
console.log(`\nALL ${passed} END-TO-END CHECKS PASSED`);
process.exit(0);
