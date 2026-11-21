#!/usr/bin/env node
// Real browsers, real media: two separate Chrome instances (two accounts, fake camera and microphone) call each
// other through the app on the LOCAL stack and the LiveKit dev project. Covers answer, talk, mute, hang up,
// decline, cancel while ringing, refresh and rejoin, and checks the camera and microphone are released after.
//
// Needs: the local stack, `supabase functions serve --env-file supabase/functions/.env`, and the app on APP_URL:
//   VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$ANON_KEY npx vite --port 5199
//   API_URL=… ANON_KEY=… SERVICE_ROLE_KEY=… npm run test:calls:e2e
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-core';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, APP_URL = 'http://localhost:5199', HEADED, ONLY } = process.env;
// ONLY=1,5 runs just those rounds (handy on a slow network); the history check needs all five.
const run = (n) => !ONLY || ONLY.split(',').includes(String(n));
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) { console.error('Set API_URL, ANON_KEY and SERVICE_ROLE_KEY from `supabase status -o env`.'); process.exit(1); }
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(API_URL)) { console.error('This test only runs against a local stack.'); process.exit(1); }

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(API_URL, SERVICE_ROLE_KEY, options);
const PW = 'calls-e2e-password-1';
const storageKey = `sb-${new URL(API_URL).hostname.split('.')[0]}-auth-token`;
let passed = 0;
const step = (name) => { passed += 1; console.log(`  ok  ${name}`); };

async function learner(name, native, learning) {
  const email = `e2e-callui-${name}@test.local`;
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  const old = list.users.find((u) => u.email === email);
  if (old) await service.auth.admin.deleteUser(old.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PW, email_confirm: true });
  assert.equal(error, null, `create ${name}: ${error?.message}`);
  const c = createClient(API_URL, ANON_KEY, options);
  const { data: s } = await c.auth.signInWithPassword({ email, password: PW });
  for (const kind of ['age_18', 'terms', 'privacy']) await c.rpc('record_consent', { p_kind: kind, p_version: kind === 'privacy' ? '3' : '1' });
  assert.equal((await c.rpc('set_language_profile', { p_native: native, p_learning: learning, p_level: 'A2' })).error, null);
  const r = await c.rpc('save_profile', { p_username: `callui_${name}`, p_display_name: `Caller ${name.toUpperCase()}`, p_bio: '', p_timezone: 'UTC', p_is_private: false, p_avatar_url: null, p_country: null });
  assert.equal(r.error, null, `profile: ${r.error?.message}`);
  return { id: data.user.id, c, session: s.session, name: `Caller ${name.toUpperCase()}` };
}

async function browserFor(person, { camera = true } = {}) {
  // Without the auto-accept flag, anything not granted below is refused, as if the person said no.
  const browser = await chromium.launch({
    channel: 'chrome', headless: !HEADED,
    args: [...(camera ? ['--use-fake-ui-for-media-stream'] : []), '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ permissions: camera ? ['camera', 'microphone'] : ['microphone'] });
  // Signed in as this person, and every camera/microphone track recorded, so we can check they were stopped.
  await ctx.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session));
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__tracks = [];
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); window.__tracks.push(...s.getTracks()); return s; };
  }, [storageKey, person.session]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`    [${person.name} page error] ${e.message}`));
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 200)); });
  return { browser, page, logs };
}

const liveTracks = (page) => page.evaluate(() => (window.__tracks ?? []).filter((t) => t.readyState === 'live').length);
const playingVideos = (page) => page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.videoWidth > 0 && !v.paused).length);
const waitFor = async (fn, what, ms = 30_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn().catch(() => false)) return; await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`timed out waiting for ${what}`);
};
const lastCall = async (a) => (await service.from('calls').select('*').eq('initiated_by', a).order('created_at', { ascending: false }).limit(1).single()).data;

async function main() {
  const A = await learner('a', 'eng', 'spa'); const B = await learner('b', 'spa', 'eng');
  const conv = (await A.c.rpc('start_conversation', { p_target: B.id })).data;
  await B.c.rpc('respond_message_request', { p_conv: conv, p_accept: true });
  const a = await browserFor(A); const b = await browserFor(B);
  try {
    if (run(1)) {
    // 1. The call button in the chat, preview, ring, answer from the banner, talk both ways.
    await b.page.goto(`${APP_URL}/home`);
    await a.page.goto(`${APP_URL}/messages/${conv}`);
    await a.page.getByRole('button', { name: `Video call ${B.name}` }).click();
    await a.page.waitForURL(/\/call\/new\?to=/);
    await waitFor(async () => (await playingVideos(a.page)) >= 1, 'the caller\'s preview');
    await a.page.getByRole('button', { name: `Call ${B.name}` }).click();
    await a.page.getByText(`Calling ${B.name}…`).waitFor({ timeout: 20_000 });
    step('the caller opens a preview from the chat, then rings');

    const banner = b.page.getByRole('alertdialog', { name: `${A.name} is calling you` });
    await banner.waitFor({ timeout: 20_000 });
    await banner.getByRole('button', { name: `Answer the call from ${A.name}` }).click();
    await b.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await waitFor(async () => (await playingVideos(a.page)) >= 2 && (await playingVideos(b.page)) >= 2, 'video both ways', 90_000);
    await a.page.getByText(/^\d+:\d\d$/).waitFor();
    step('the callee answers from the banner; both see and hear each other');

    const call1 = await lastCall(A.id);
    assert.equal(call1.status, 'active');
    await waitFor(async () => (await service.from('call_participants').select('presence').eq('call_id', call1.id)).data.every((p) => p.presence === 'joined'), 'both marked joined');

    await a.page.getByRole('button', { name: 'Turn microphone off' }).click();
    await b.page.getByLabel('Microphone off').waitFor({ timeout: 10_000 });
    await a.page.getByRole('button', { name: 'Turn camera off' }).click();
    await waitFor(async () => (await playingVideos(b.page)) === 1, 'the camera going off for the other side', 30_000);
    await a.page.getByRole('button', { name: 'Turn camera on' }).click();
    await a.page.getByRole('button', { name: 'Turn microphone on' }).click();
    step('mute and camera off reach the other side');

    await b.page.getByRole('button', { name: 'Hang up' }).click();
    await a.page.getByRole('heading', { name: 'Call ended' }).waitFor({ timeout: 15_000 });
    await b.page.getByRole('heading', { name: 'Call ended' }).waitFor({ timeout: 15_000 });
    await waitFor(async () => (await liveTracks(a.page)) === 0 && (await liveTracks(b.page)) === 0, 'camera and microphone released');
    assert.equal((await service.from('calls').select('status').eq('id', call1.id).single()).data.status, 'ended');
    step('hanging up ends it for both, and releases the camera and microphone');

    }
    if (run(2)) {
    // 2. Declined, the other way round.
    await a.page.goto(`${APP_URL}/home`);
    await b.page.goto(`${APP_URL}/call/new?to=${A.id}`);
    await b.page.getByRole('button', { name: /^Call / }).click();
    const banner2 = a.page.getByRole('alertdialog', { name: `${B.name} is calling you` });
    await banner2.waitFor({ timeout: 20_000 });
    await banner2.getByRole('button', { name: `Decline the call from ${B.name}` }).click();
    await b.page.getByRole('heading', { name: 'Call declined' }).waitFor({ timeout: 15_000 });
    await banner2.waitFor({ state: 'detached' });
    await waitFor(async () => (await liveTracks(b.page)) === 0, 'tracks released after a decline');
    step('a declined call tells the caller and releases their devices');

    }
    if (run(3)) {
    // 3. Cancelled while ringing: the banner goes away.
    await b.page.goto(`${APP_URL}/home`);
    await a.page.goto(`${APP_URL}/call/new?to=${B.id}`);
    await a.page.getByRole('button', { name: `Call ${B.name}` }).click();
    const banner3 = b.page.getByRole('alertdialog', { name: `${A.name} is calling you` });
    await banner3.waitFor({ timeout: 20_000 });
    await a.page.getByRole('button', { name: 'Cancel call' }).click();
    await a.page.getByRole('heading', { name: 'Call cancelled' }).waitFor({ timeout: 15_000 });
    await banner3.waitFor({ state: 'detached', timeout: 15_000 });
    step('cancelling while it rings removes the banner on the other side');

    }
    if (run(4)) {
    // 4. A refresh mid-call: rejoin, no duplicate membership, then hang up.
    await a.page.goto(`${APP_URL}/call/new?to=${B.id}`);
    await a.page.getByRole('button', { name: `Call ${B.name}` }).click();
    const banner4 = b.page.getByRole('alertdialog', { name: `${A.name} is calling you` });
    await banner4.waitFor({ timeout: 20_000 });
    await banner4.getByRole('button', { name: `Answer the call from ${A.name}` }).click();
    await b.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await waitFor(async () => (await playingVideos(b.page)) >= 2, 'connected before the refresh', 90_000);
    await a.page.reload();
    await a.page.getByRole('button', { name: 'Rejoin the call' }).click();
    await waitFor(async () => (await playingVideos(a.page)) >= 2 && (await playingVideos(b.page)) >= 2, 'video both ways after rejoining', 90_000);
    const call4 = await lastCall(A.id);
    assert.equal((await service.from('call_participants').select('id').eq('call_id', call4.id)).data.length, 2, 'still exactly two members');
    await a.page.getByRole('button', { name: 'Hang up' }).click();
    await b.page.getByRole('heading', { name: 'Call ended' }).waitFor({ timeout: 15_000 });
    step('after a refresh the caller rejoins the same call; hanging up still ends it');

    }
    if (run(5)) {
    // 5. Camera blocked: a clear message, a call with sound only; then the tab is closed mid-call.
    await a.browser.close();
    Object.assign(a, await browserFor(A, { camera: false }));
    await a.page.goto(`${APP_URL}/home`);
    await b.page.goto(`${APP_URL}/call/new?to=${A.id}`);
    await b.page.getByRole('button', { name: `Call ${A.name}` }).click();
    const banner5 = a.page.getByRole('alertdialog', { name: `${B.name} is calling you` });
    await banner5.waitFor({ timeout: 20_000 });
    await banner5.getByRole('button', { name: `Answer the call from ${B.name}` }).click();
    await a.page.getByText(/blocked the camera/).waitFor({ timeout: 15_000 });
    await a.page.getByText('You can still talk with sound only.').waitFor();
    await a.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await waitFor(async () => (await playingVideos(a.page)) >= 1 && (await b.page.getByText(/^\d+:\d\d$/).count()) === 1, 'a call with sound only', 90_000);
    await waitFor(async () => (await b.page.getByLabel('Microphone off').count()) === 0, 'their microphone showing as on', 20_000);
    assert.equal(await a.page.getByRole('button', { name: 'Turn camera on' }).count(), 1, 'the camera shows as off');
    step('with the camera blocked, the person is told how to fix it and joins with sound only');

    await a.page.close();
    await b.page.getByText(`Waiting for ${A.name} to join…`).waitFor({ timeout: 30_000 });
    await b.page.getByRole('button', { name: 'Hang up' }).click();
    await b.page.getByRole('heading', { name: 'Call ended' }).waitFor({ timeout: 15_000 });
    step('when the other tab closes, the call waits for them to come back, and can be ended');

    }
    if (!ONLY) {
    const hist = (await A.c.rpc('list_call_history', { p_limit: 10 })).data;
    assert.equal(hist.length, 5);
    assert.deepEqual(hist.map((h) => h.end_reason), ['hung_up', 'hung_up', 'cancelled', 'declined', 'hung_up']);
    step('history records all five calls with how each ended');
    }
  } catch (e) {
    const dir = process.env.SHOTS_DIR;
    if (dir) for (const [who, x] of [['a', a], ['b', b]]) {
      await x.page.screenshot({ path: `${dir}/call-${who}.png` }).catch(() => undefined);
      x.logs?.slice(-8).forEach((l) => console.log(`    [${who} console] ${l}`));
      console.log(`    [${who}] ${x.page.url()} :: ${(await x.page.innerText('body').catch(() => '')).slice(0, 300).replace(/\s+/g, ' ')}`);
    }
    throw e;
  } finally {
    await a.browser.close(); await b.browser.close();
  }
  console.log(`\n${passed} checks passed`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(`\nFAILED after ${passed} checks:\n${e.message}`); process.exit(1); });
