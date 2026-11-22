#!/usr/bin/env node
// End-to-end check of the call edge functions against the LOCAL stack: who gets a media token, what the token
// allows, hanging up, and signed provider webhooks (bad signatures, replays, intruders). It never prints a token or
// secret. Needs `supabase functions serve --env-file supabase/functions/.env` running, with LIVEKIT_* in that file.
//
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')" && API_URL=$API_URL ANON_KEY=$ANON_KEY SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm run test:calls
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) { console.error('Set API_URL, ANON_KEY and SERVICE_ROLE_KEY from `supabase status -o env`.'); process.exit(1); }
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(API_URL)) { console.error('This test only runs against a local stack.'); process.exit(1); }
const lk = Object.fromEntries(readFileSync(new URL('../supabase/functions/.env', import.meta.url), 'utf8').split('\n')
  .map((l) => l.match(/^(LIVEKIT_[A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
if (!lk.LIVEKIT_API_KEY || !lk.LIVEKIT_API_SECRET) { console.error('LIVEKIT_* missing from supabase/functions/.env'); process.exit(1); }

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(API_URL, SERVICE_ROLE_KEY, options);
const PW = 'calls-test-password-1';
let passed = 0;
const step = (name) => { passed += 1; console.log(`  ok  ${name}`); };
const b64url = (b) => Buffer.from(b).toString('base64url');
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

async function learner(name, native, learning) {
  const email = `e2e-call-${name}@test.local`;
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  const old = list.users.find((u) => u.email === email);
  if (old) await service.auth.admin.deleteUser(old.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PW, email_confirm: true });
  assert.equal(error, null, `create ${name}: ${error?.message}`);
  const c = createClient(API_URL, ANON_KEY, options);
  assert.equal((await c.auth.signInWithPassword({ email, password: PW })).error, null);
  await c.rpc('set_language_profile', { p_native: native, p_learning: learning, p_level: 'A2' });
  assert.equal((await c.rpc('set_birth_date', { p_birth: '1995-01-01', p_minor_rules: '1' })).error, null, `birth date ${name}`);
  const token = (await c.auth.getSession()).data.session.access_token;
  return { id: data.user.id, c, token };
}
async function fn(name, body, token) {
  const res = await fetch(`${API_URL}/functions/v1/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
// Signed exactly as the provider signs: an HS256 JWT from our API key, carrying the body's SHA-256.
function signed(body, secret = lk.LIVEKIT_API_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: lk.LIVEKIT_API_KEY, nbf: now - 5, exp: now + 300, sha256: createHash('sha256').update(body).digest('base64') }));
  return `${head}.${payload}.${createHmac('sha256', secret).update(`${head}.${payload}`).digest('base64url')}`;
}
async function webhook(event, room, identity, id = `EV_${Math.random().toString(36).slice(2)}`, secret) {
  const body = JSON.stringify({ event, id, room: { name: room }, ...(identity ? { participant: { identity } } : {}), createdAt: String(Math.floor(Date.now() / 1000)) });
  const res = await fetch(`${API_URL}/functions/v1/livekit-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/webhook+json', Authorization: signed(body, secret) }, body });
  return { status: res.status, body: await res.json().catch(() => ({})), id };
}
const presence = async (call, user) => (await service.from('call_participants').select('presence').eq('call_id', call).eq('user_id', user).single()).data?.presence;

async function main() {
  const a = await learner('a', 'eng', 'spa'); const b = await learner('b', 'spa', 'eng'); const s = await learner('s', 'eng', 'spa');
  const conv = (await a.c.rpc('start_conversation', { p_target: b.id })).data;
  await b.c.rpc('respond_message_request', { p_conv: conv, p_accept: true });
  const { data: call, error } = await a.c.rpc('start_call', { p_callee: b.id });
  assert.equal(error, null, `start_call: ${error?.message}`);
  const room = (await service.from('calls').select('provider_room').eq('id', call).single()).data.provider_room;

  assert.equal((await fn('call-token', { call_id: call })).status, 401, 'no session, no token');
  assert.equal((await fn('call-token', { call_id: 'not-a-uuid' }, a.token)).status, 400, 'bad input');
  assert.equal((await fn('call-token', '{oops', a.token)).status, 400, 'bad JSON');
  step('no session or bad input is refused');

  let r = await fn('call-token', { call_id: call }, s.token);
  assert.equal(r.status, 403); assert.equal(r.body.error, 'call_unavailable'); assert.equal(r.body.token, undefined);
  r = await fn('call-token', { call_id: room }, s.token);
  assert.equal(r.status, 400, 'a room name is not a call id');
  r = await fn('call-token', { call_id: call }, b.token);
  assert.equal(r.status, 403, 'the callee gets no token before answering');
  step('strangers, guessed room names and unanswered invitations get no token');

  r = await fn('call-token', { call_id: call }, a.token);
  assert.equal(r.status, 200, `caller token: ${JSON.stringify(r.body)}`);
  assert.match(r.body.url, /^wss:\/\//);
  const t = claims(r.body.token);
  assert.equal(t.sub, a.id, 'identity is the verified user');
  assert.equal(t.iss, lk.LIVEKIT_API_KEY);
  assert.equal(t.video.room, room, 'scoped to this room');
  assert.equal(t.video.roomJoin, true);
  assert.equal(t.video.canPublishData, true, 'in-call messages go over the room data channel');
  assert.deepEqual([...t.video.canPublishSources].sort(), ['camera', 'microphone'], 'camera and microphone only');
  for (const g of ['roomCreate', 'roomAdmin', 'roomList', 'roomRecord', 'recorder', 'ingressAdmin', 'hidden', 'agent']) assert.ok(!t.video[g], `no ${g}`);
  assert.ok(t.exp - t.nbf <= 600 && t.exp - t.nbf >= 60, `short-lived: ${t.exp - t.nbf}s`);
  step('the caller gets a short-lived token for this room only, as themselves, camera and microphone only');

  await b.c.rpc('respond_call_invite', { p_call: call, p_accept: true });
  r = await fn('call-token', { call_id: call }, b.token);
  assert.equal(r.status, 200); assert.equal(claims(r.body.token).sub, b.id);
  step('after answering, the callee gets their own token');

  assert.equal((await webhook('participant_joined', room, a.id, undefined, 'wrong-secret')).status, 401);
  const fake = JSON.stringify({ event: 'room_finished', id: 'EV_x', room: { name: room } });
  assert.equal((await fetch(`${API_URL}/functions/v1/livekit-webhook`, { method: 'POST', headers: { Authorization: 'Bearer nope' }, body: fake })).status, 401);
  assert.equal((await fetch(`${API_URL}/functions/v1/livekit-webhook`, { method: 'POST', body: fake })).status, 401);
  step('webhooks with a bad or missing signature are rejected');

  const j = await webhook('participant_joined', room, a.id);
  assert.equal(j.status, 200); assert.equal(j.body.result, 'ok');
  assert.equal(await presence(call, a.id), 'joined');
  const again = await webhook('participant_joined', room, a.id, j.id);
  assert.equal(again.body.result, 'duplicate', 'a replay is applied once');
  const intruder = await webhook('participant_joined', room, s.id);
  assert.equal(intruder.body.result, 'not_allowed', 'an identity with no invitation is flagged and removed');
  assert.equal((await service.from('call_participants').select('id').eq('call_id', call).eq('user_id', s.id)).data.length, 0);
  step('signed webhooks set attendance once; replays and intruders are handled');

  await webhook('participant_joined', room, b.id);
  await webhook('participant_left', room, a.id);
  assert.equal(await presence(call, a.id), 'left');
  assert.equal((await service.from('calls').select('status').eq('id', call).single()).data.status, 'active', 'a drop does not end the call');
  await webhook('participant_left', room, b.id);
  assert.ok((await service.from('calls').select('last_empty_at').eq('id', call).single()).data.last_empty_at, 'empty room starts the grace period');
  step('an unexpected drop keeps the call open for a rejoin, and an empty room starts the grace period');

  assert.equal((await fn('call-control', { call_id: call, action: 'end' }, s.token)).status, 403, 'a stranger cannot end it');
  assert.equal((await fn('call-control', { call_id: call, action: 'end' }, b.token)).status, 403, 'the callee is not the host');
  assert.equal((await fn('call-control', { call_id: call, action: 'explode' }, a.token)).status, 400);
  r = await fn('call-control', { call_id: call, action: 'leave' }, b.token);
  assert.equal(r.status, 200); assert.equal(r.body.ended, true);
  assert.equal((await service.from('calls').select('status').eq('id', call).single()).data.status, 'ended');
  r = await fn('call-token', { call_id: call }, a.token);
  assert.equal(r.status, 403, 'no token for an ended call');
  step('hanging up ends the call and closes the room; nothing joins afterwards');

  const logs = (await service.from('app_logs').select('message, context').like('source', 'edge:call-%').order('created_at', { ascending: false }).limit(50)).data;
  assert.ok(logs.length > 0, 'calls are logged');
  assert.ok(!JSON.stringify(logs).includes(lk.LIVEKIT_API_SECRET) && !JSON.stringify(logs).includes('eyJ'), 'no secret or token in the logs');
  step('token issue and refusals are logged, with no token or secret');

  console.log(`\n${passed} checks passed`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(`\nFAILED after ${passed} checks:\n${e.message}`); process.exit(1); });
