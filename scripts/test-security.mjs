#!/usr/bin/env node
// End-to-end check of who can reach what, against the LOCAL Supabase stack: real API, Storage and Realtime, with
// real tokens. Covers leaks, avatars, rate limits and the pause switch. It recreates its own test accounts and
// flips the switch, so it refuses to run on anything but localhost.
//
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')" && API_URL=$API_URL ANON_KEY=$ANON_KEY SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm run test:security
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) { console.error('Set API_URL, ANON_KEY and SERVICE_ROLE_KEY from `supabase status -o env`.'); process.exit(1); }
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(API_URL)) { console.error('This test only runs against a local stack.'); process.exit(1); }

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(API_URL, SERVICE_ROLE_KEY, options);
const client = () => createClient(API_URL, ANON_KEY, options);
const PW = 'security-test-password-1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const step = (name) => { passed += 1; console.log(`  ok  ${name}`); };

function totp(secret) {
  let bits = ''; for (const c of secret.replace(/=+$/, '')) bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', key).update(counter).digest(); const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function account(name) {
  const email = `e2e-sec-${name}@test.local`;
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  const old = list.users.find((u) => u.email === email);
  if (old) await service.auth.admin.deleteUser(old.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PW, email_confirm: true });
  assert.equal(error, null, `create ${name}: ${error?.message}`);
  return { id: data.user.id, email };
}
async function login(a) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: PW });
  assert.equal(error, null, `login ${a.email}: ${error?.message}`);
  return c;
}
async function learner(name, native, learning) {
  const a = await account(name); const c = await login(a);
  let r = await c.rpc('set_language_profile', { p_native: native, p_learning: learning, p_level: 'A2' });
  assert.equal(r.error, null, `languages: ${r.error?.message}`);
  r = await c.rpc('save_profile', { p_username: `sec_${name}`, p_display_name: name, p_bio: 'private bio', p_timezone: 'UTC', p_is_private: false, p_avatar_url: null, p_country: null });
  assert.equal(r.error, null, `profile: ${r.error?.message}`);
  return { ...a, c };
}
async function staffLogin(a) {
  await sleep(1100);   // a code must be newer than the account's sessions_valid_after, in whole seconds
  const c = await login(a);
  const { data: f, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Phone' });
  assert.equal(error, null, `enroll: ${error?.message}`);
  const { data: ch } = await c.auth.mfa.challenge({ factorId: f.id });
  const v = await c.auth.mfa.verify({ factorId: f.id, challengeId: ch.id, code: totp(f.totp.secret) });
  assert.equal(v.error, null, `verify: ${v.error?.message}`);
  return c;
}
const denied = (r, what) => assert.ok(r.error, `${what} should be refused, got ${JSON.stringify(r.data)?.slice(0, 120)}`);
const subscribed = (ch, ms = 25000) => new Promise((resolve) => {
  const t = setTimeout(() => resolve('TIMED_OUT'), ms);
  ch.subscribe((s) => { if (s !== 'CLOSED') { clearTimeout(t); resolve(s); } });
});
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64');
const upload = (c, path) => c.storage.from('avatars').upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' });
const setPausedDirect = (paused) => service.from('app_status').update({ paused, paused_at: paused ? new Date().toISOString() : null }).eq('id', true);

async function main() {
  await setPausedDirect(false);
  const anon = client();
  const a = await learner('amina', 'swh', 'eng');
  const b = await learner('linh', 'eng', 'swh');
  const stranger = await learner('zed', 'fra', 'eng');

  console.log('Signed out');
  for (const t of ['profiles', 'user_languages', 'messages', 'notifications', 'contribution_posts', 'post_discussion', 'saved_phrases', 'banned_emails', 'push_settings', 'reports', 'admin_accounts', 'rate_limit_rules'])
    denied(await anon.from(t).select('*').limit(1), `anon reading ${t}`);
  step('no table about people can be read');
  assert.ok((await anon.from('languages').select('id').limit(1)).data?.length, 'languages stay public');
  step('the language list stays public');
  denied(await anon.rpc('search_people', { p_query: 'sec', p_language: null, p_role: null, p_level: null, p_scope: null, p_limit: 5, p_offset: 0 }), 'anon search');
  step('search needs an account');

  console.log('Between members');
  denied(await a.c.from('profiles').select('role').eq('id', b.id), 'reading someone\'s role');
  denied(await a.c.from('profiles').select('*').eq('id', b.id), 'select * on profiles');
  for (const col of ['notification_prefs', 'accountability_exempt', 'points_balance', 'timezone', 'bio', 'status']) denied(await a.c.from('profiles').select(col).eq('id', b.id), `reading ${col}`);
  step('private profile columns are hidden');
  const pub = await a.c.from('profiles').select('id, username, display_name, avatar_url').eq('id', b.id).single();
  assert.equal(pub.data?.username, 'sec_linh', `author fields stay readable: ${pub.error?.message}`);
  step('author name and photo stay readable');
  const mine = await a.c.rpc('get_my_profile');
  assert.equal(mine.data?.id, a.id); assert.equal(mine.data?.role, 'user'); assert.equal(mine.data?.bio, 'private bio');
  step('your own full profile still loads');
  denied(await a.c.from('profiles').update({ accountability_exempt: true }).eq('id', a.id), 'self exemption');
  denied(await a.c.from('profiles').update({ bio: 'x'.repeat(5000) }).eq('id', a.id), 'direct profile write');
  step('profiles can\'t be written directly');
  assert.equal((await a.c.from('user_languages').select('*').eq('user_id', b.id)).data?.length, 0, 'someone else\'s languages');
  assert.equal((await a.c.from('user_languages').select('*').eq('user_id', a.id)).data?.length, 2, 'own languages');
  step('language rows are private to their owner');

  const conv = await a.c.rpc('start_conversation', { p_target: b.id });
  assert.equal(conv.error, null, `start_conversation: ${conv.error?.message}`);
  const convId = conv.data;
  const sent = await a.c.rpc('send_message', { p_conv: convId, p_body: 'hello secret', p_reply_to: null, p_language: 'swh', p_bounty: false });
  assert.equal(sent.error, null, `send_message: ${sent.error?.message}`);
  assert.equal((await b.c.from('messages').select('id').eq('conversation_id', convId)).data?.length, 1, 'the other member reads it');
  assert.equal((await stranger.c.from('messages').select('id').eq('conversation_id', convId)).data?.length, 0, 'a stranger reads nothing');
  assert.equal((await stranger.c.rpc('peer_read_at', { p_conv: convId })).data, null, 'a stranger can\'t see read times');
  step('a conversation is only visible to its members');

  const bNotes = await b.c.rpc('list_notifications', { p_limit: 30, p_before: null, p_category: null });
  assert.ok(bNotes.data?.length, 'the message request notified them');
  assert.equal((await a.c.from('notifications').select('id').eq('user_id', b.id)).data?.length, 0, 'someone else\'s notifications');
  denied(await a.c.from('notifications').delete().eq('user_id', b.id), 'deleting notifications');
  denied(await b.c.from('notifications').delete().eq('id', bNotes.data[0].id), 'direct delete of your own');
  assert.equal((await b.c.rpc('delete_notifications', { p_ids: [bNotes.data[0].id] })).error, null, 'deleting through the function works');
  step('notifications are private to their owner');

  denied(await a.c.from('saved_phrases').insert({ user_id: a.id, phrase: 'x', is_public: true }), 'direct phrase insert');
  denied(await a.c.from('contribution_posts').delete().eq('user_id', a.id), 'direct post delete');
  denied(await a.c.from('messages').insert({ conversation_id: convId, sender_id: a.id, body: 'x' }), 'direct message insert');
  step('rules in functions can\'t be skipped through direct writes');

  console.log('Typing channels');
  const member = a.c.channel(`ft-chat:${convId}`, { config: { private: true } });
  await a.c.realtime.setAuth((await a.c.auth.getSession()).data.session.access_token);
  assert.equal(await subscribed(member), 'SUBSCRIBED', 'a member joins');
  await stranger.c.realtime.setAuth((await stranger.c.auth.getSession()).data.session.access_token);
  const outsider = stranger.c.channel(`ft-chat:${convId}`, { config: { private: true } });
  assert.notEqual(await subscribed(outsider), 'SUBSCRIBED', 'a stranger is refused');
  a.c.removeChannel(member); stranger.c.removeChannel(outsider);
  step('only members can join a chat\'s typing channel');

  console.log('Avatars');
  const up = await upload(a.c, `${a.id}/avatar.jpg`);
  assert.equal(up.error, null, `own upload: ${up.error?.message}`);
  const url = a.c.storage.from('avatars').getPublicUrl(`${a.id}/avatar.jpg`).data.publicUrl;
  assert.equal((await fetch(url)).status, 200, 'photo opens from its URL with no token');
  step('a photo is public by URL');
  assert.equal((await anon.storage.from('avatars').list(a.id)).data?.length ?? 0, 0, 'signed out listing');
  assert.equal((await b.c.storage.from('avatars').list(a.id)).data?.length ?? 0, 0, 'another member listing');
  assert.equal((await anon.storage.from('avatars').list('')).data?.length ?? 0, 0, 'listing the bucket');
  assert.equal((await a.c.storage.from('avatars').list(a.id)).data?.length, 1, 'your own folder');
  step('the bucket can\'t be listed');
  denied(await upload(b.c, `${a.id}/avatar.jpg`), 'overwriting someone\'s photo');
  denied(await upload(b.c, `${a.id}/evil.jpg`), 'writing in someone\'s folder');
  denied(await anon.storage.from('avatars').upload(`${a.id}/anon.jpg`, jpeg, { contentType: 'image/jpeg' }), 'signed out upload');
  denied(await b.c.storage.from('avatars').remove([`${a.id}/avatar.jpg`]).then((r) => (r.data?.length ? { data: r.data } : { error: 'nothing removed' })).then((r) => ('error' in r ? r : { error: null, data: r.data })), 'removing someone\'s photo');
  denied(await a.c.storage.from('avatars').upload(`${a.id}/page.html`, Buffer.from('<script>1</script>'), { contentType: 'text/html' }), 'an HTML file');
  denied(await a.c.storage.from('avatars').upload(`${a.id}/x.svg`, Buffer.from('<svg/>'), { contentType: 'image/svg+xml' }), 'an SVG');
  denied(await a.c.storage.from('avatars').upload(`${a.id}/x.exe`, jpeg, { contentType: 'image/jpeg' }), 'a non-image file name');
  denied(await a.c.storage.from('avatars').upload(`${a.id}/big.jpg`, Buffer.alloc(2_200_000), { contentType: 'image/jpeg' }), 'a file over the limit');
  step('uploads are limited to your own folder, images and 2 MB');
  for (let i = 1; i <= 4; i += 1) assert.equal((await upload(a.c, `${a.id}/extra${i}.jpg`)).error, null, `extra file ${i}`);
  denied(await upload(a.c, `${a.id}/sixth.jpg`), 'a sixth file');
  assert.equal((await upload(a.c, `${a.id}/avatar.jpg`)).error, null, 'replacing a photo still works at the cap');
  await a.c.storage.from('avatars').remove([1, 2, 3, 4].map((i) => `${a.id}/extra${i}.jpg`));
  step('one account can\'t fill the bucket');

  const save = (avatar) => a.c.rpc('save_profile', { p_username: 'sec_amina', p_display_name: 'amina', p_bio: '', p_timezone: 'UTC', p_is_private: false, p_avatar_url: avatar, p_country: null });
  const photo = async () => (await a.c.rpc('get_my_profile')).data.avatar_url;
  assert.equal((await save(`${url}?v=1`)).error, null);
  assert.equal(await photo(), `${url}?v=1`, 'own photo saves');
  await save('https://evil.example/track.gif');
  assert.equal(await photo(), `${url}?v=1`, 'a tracking URL is ignored');
  await save(url.replace(a.id, b.id));
  assert.equal(await photo(), `${url}?v=1`, 'someone else\'s photo is ignored');
  await save(`https://evil.example/storage/v1/object/public/avatars/${a.id}/x.jpg`);
  assert.equal(await photo(), `${url}?v=1`, 'a look-alike URL is ignored');
  step('a profile photo can only point at your own folder');

  console.log('Rate limits');
  await service.from('rate_limit_rules').upsert({ path: '/rpc/set_show_activity', max_hits: 3, window_seconds: 3600 });
  for (let i = 0; i < 3; i += 1) assert.equal((await a.c.rpc('set_show_activity', { p_show: true })).error, null, `call ${i + 1} is allowed`);
  const over = await a.c.rpc('set_show_activity', { p_show: true });
  assert.ok(over.error?.message.includes('rate_limited'), `the 4th is refused: ${over.error?.message}`);
  assert.equal(over.status, 429);
  assert.equal((await b.c.rpc('set_show_activity', { p_show: true })).error, null, 'another person is not affected');
  assert.equal((await a.c.rpc('list_notifications', { p_limit: 1, p_before: null, p_category: null })).error, null, 'the same person can still read');
  await service.from('rate_limit_rules').delete().eq('path', '/rpc/set_show_activity');
  step('a limit stops one person at one action, with a 429');
  const search = (await service.from('rate_limit_rules').select('max_hits').eq('path', '/rpc/search_people').single()).data;
  await service.from('rate_limit_rules').update({ max_hits: 1 }).eq('path', '/rpc/search_people');
  const args = { p_query: 'sec', p_language: null, p_role: null, p_level: null, p_scope: null, p_limit: 5, p_offset: 0 };
  assert.equal((await b.c.rpc('search_people', args)).error, null, 'first search');
  assert.ok((await b.c.rpc('search_people', args)).error?.message.includes('rate_limited'), 'second search is limited');
  await service.from('rate_limit_rules').update({ max_hits: search.max_hits }).eq('path', '/rpc/search_people');
  step('searches are counted too');
  const repeatReports = [];
  for (let i = 0; i < 11; i += 1) repeatReports.push(await stranger.c.rpc('report_user', { p_target: b.id, p_reason: 'spam', p_details: null, p_conversation: null }));
  assert.ok(repeatReports.at(-1).error?.message.includes('rate_limited'), `the 11th report in an hour is refused: ${repeatReports.at(-1).error?.message}`);
  step('reports are capped at 10 an hour by default');

  console.log('Staff and learner notifications');
  const adminAcc = await account('admin'); const modAcc = await account('mod');
  assert.equal((await service.from('admin_accounts').insert({ user_id: adminAcc.id, tier: 'admin' })).error, null);
  assert.equal((await service.from('admin_accounts').insert({ user_id: modAcc.id, tier: 'moderator' })).error, null);
  const aal1 = await login(adminAcc);
  const admin = await staffLogin(adminAcc); const mod = await staffLogin(modAcc);
  const filed = await a.c.rpc('report_user', { p_target: b.id, p_reason: 'spam', p_details: null, p_conversation: null });
  assert.equal(filed.error, null, `report: ${filed.error?.message}`);
  const adminNotes = await admin.rpc('list_notifications', { p_limit: 30, p_before: null, p_category: 'reports' });
  assert.ok(adminNotes.data?.some((n) => n.type === 'admin_report' && n.data.report_id === filed.data), `staff see the report: ${adminNotes.error?.message}`);
  assert.ok((await a.c.rpc('list_notifications', { p_limit: 100, p_before: null, p_category: null })).data.every((n) => !n.type.startsWith('admin_')), 'learners see no staff alerts');
  // A learner row sitting on a staff account stays out of the staff feed, and the other way around.
  await service.from('notifications').insert({ user_id: adminAcc.id, type: 'level_up', data: {} });
  await service.from('notifications').insert({ user_id: a.id, type: 'admin_report', data: { reason: 'left over from staff days' } });
  assert.ok((await admin.rpc('list_notifications', { p_limit: 100, p_before: null, p_category: null })).data.every((n) => n.type !== 'level_up'), 'no learner rows in the staff feed');
  assert.ok((await a.c.rpc('list_notifications', { p_limit: 100, p_before: null, p_category: null })).data.every((n) => !n.type.startsWith('admin_')), 'former staff lose staff alerts');
  step('each side gets only its own notifications');

  console.log('The pause switch');
  denied(await a.c.rpc('admin_set_app_paused', { p_paused: true, p_reason: 'x', p_message: null }), 'a learner pausing');
  denied(await aal1.rpc('admin_set_app_paused', { p_paused: true, p_reason: 'x', p_message: null }), 'staff without an authenticator code');
  denied(await mod.rpc('admin_set_app_paused', { p_paused: true, p_reason: 'x', p_message: null }), 'a moderator pausing');
  denied(await admin.rpc('admin_set_app_paused', { p_paused: true, p_reason: ' ', p_message: null }), 'pausing with no reason');
  denied(await a.c.from('app_status').update({ paused: true }).eq('id', true), 'writing the status directly');
  assert.equal((await anon.rpc('get_app_status')).data.paused, false);
  step('only a full admin with a code and a reason can press it');

  const live = [];
  const liveCh = b.c.channel('sec-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, (p) => live.push(p.new.body));
  await b.c.realtime.setAuth((await b.c.auth.getSession()).data.session.access_token);
  assert.equal(await subscribed(liveCh), 'SUBSCRIBED', 'open tab listening');
  const direct = (body) => service.from('messages').insert({ conversation_id: convId, sender_id: a.id, body });
  await sleep(8000);   // Realtime's database subscription comes a few seconds after SUBSCRIBED
  assert.equal((await direct('before')).error, null);
  await sleep(5000);
  assert.deepEqual(live, ['before'], 'the socket gets messages while open');

  const paused = await admin.rpc('admin_set_app_paused', { p_paused: true, p_reason: 'e2e test', p_message: 'Back at noon' });
  assert.equal(paused.error, null, `pause: ${paused.error?.message}`);
  assert.equal(paused.data.enforced, true, 'the API is wired to the switch');
  try {
    const s = await anon.rpc('get_app_status');
    assert.equal(s.data.paused, true); assert.equal(s.data.message, 'Back at noon'); assert.equal(s.data.exempt, false);
    assert.equal(s.data.enforced, undefined, 'only staff are told about wiring');
    step('anyone can see the status and the message');

    const r = await a.c.rpc('list_notifications', { p_limit: 1, p_before: null, p_category: null });
    assert.equal(r.status, 503); assert.ok(r.error.message.includes('app_paused'), r.error.message);
    denied(await a.c.rpc('send_message', { p_conv: convId, p_body: 'during', p_reply_to: null, p_language: 'swh', p_bounty: false }), 'sending');
    denied(await a.c.rpc('get_my_profile'), 'loading a profile');
    denied(await a.c.from('messages').select('id').eq('conversation_id', convId), 'reading messages');
    denied(await anon.from('languages').select('id').limit(1), 'signed out reads');
    step('learners and visitors get a 503 from the API');

    denied(await upload(a.c, `${a.id}/avatar.jpg`), 'an upload');
    const su = await client().auth.signUp({ email: 'e2e-sec-during-pause@test.local', password: PW });
    assert.ok(su.error, 'a new account is refused');
    step('uploads and new accounts stop too');

    await direct('during');
    await sleep(6000);
    assert.deepEqual(live, ['before'], 'an open socket gets nothing during a pause');
    step('an open tab stops receiving live messages');

    const st = await admin.rpc('get_app_status');
    assert.equal(st.data.exempt, true);
    assert.equal((await admin.rpc('admin_overview')).error, null, 'admin keeps working');
    assert.equal((await mod.rpc('admin_list_reports', { p_status: 'open' })).error, null, 'moderator keeps working');
    assert.equal((await aal1.rpc('my_staff_status')).error, null, 'staff can finish logging in');
    denied(await aal1.rpc('admin_overview'), 'staff without a code still can\'t use admin functions');
    const heard = await mod.rpc('list_notifications', { p_limit: 5, p_before: null, p_category: 'security' });
    assert.ok(heard.data?.some((n) => n.type === 'admin_site' && n.data.paused), 'the rest of the team is told');
    assert.equal((await service.from('profiles').select('id').limit(1)).error, null, 'the service role is not affected');
    step('staff keep working and are told');
  } finally {
    const back = await admin.rpc('admin_set_app_paused', { p_paused: false, p_reason: 'e2e test over', p_message: null });
    assert.equal(back.error, null, `resume: ${back.error?.message}`);
  }
  assert.equal((await a.c.rpc('get_my_profile')).error, null, 'learners are back');
  assert.equal((await anon.from('languages').select('id').limit(1)).error, null, 'visitors are back');
  await direct('after');
  await sleep(6000);
  assert.ok(live.includes('after'), `live messages resume: ${live}`);
  b.c.removeChannel(liveCh);
  const audit = await admin.rpc('admin_audit_feed', { p_limit: 20 });
  assert.ok(audit.data.some((e) => e.action === 'app_paused') && audit.data.some((e) => e.action === 'app_resumed'), 'both are in the audit log');
  step('resuming restores everything, and both are in the audit log');

  console.log(`\n${passed} checks passed`);
}

main().then(() => process.exit(0)).catch(async (e) => {
  await setPausedDirect(false);
  console.error(`\nFAILED after ${passed} checks:\n${e.message}`);
  process.exit(1);
});
