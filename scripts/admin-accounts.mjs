#!/usr/bin/env node
// Owner-only tasks that run with the service role key, off the app. See docs/ADMIN_SETUP.md.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/admin-accounts.mjs create-super-admin
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/admin-accounts.mjs create-super-admin --adopt-existing
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/admin-accounts.mjs reset-mfa <email>
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/admin-accounts.mjs reset-password <email>
//
// Passwords are asked for here, never taken from the command line, so they stay out of shell history.
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline';

const MIN_PASSWORD = 12;
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const fail = (message) => { console.error(message); process.exit(1); };

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); if (process.stdin.isTTY) process.stdout.write('\n'); resolve(answer); });
  });
}

async function askNewPassword() {
  const pw = await askHidden(`New password (at least ${MIN_PASSWORD} characters): `);
  if (pw.length < MIN_PASSWORD) fail('That password is too short.');
  if (process.stdin.isTTY && (await askHidden('Repeat it: ')) !== pw) fail('The two passwords do not match.');
  return pw;
}

async function findUser(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

async function removeFactors(userId) {
  const { data, error } = await db.auth.admin.mfa.listFactors({ userId });
  if (error) fail(error.message);
  for (const f of data.factors ?? []) {
    const { error: e } = await db.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (e) fail(e.message);
  }
}

// The database owns the reserved address. Asking it means this script can't make an account it would then refuse.
async function superEmail() {
  const { data, error } = await db.rpc('super_admin_email');
  if (error) fail(`This database isn't ready for staff accounts. Run supabase db push first.\n${error.message}`);
  return data;
}

async function createSuperAdmin(adopt) {
  const SUPER_EMAIL = await superEmail();
  const { error: openErr } = await db.rpc('svc_open_super_bootstrap');
  if (openErr) fail(openErr.message.includes('super_admin_exists') ? 'The super admin already exists. Use reset-mfa or reset-password.' : openErr.message);
  const existing = await findUser(SUPER_EMAIL);
  if (existing && !adopt) {
    fail(`An account for ${SUPER_EMAIL} already exists (created ${existing.created_at}), so someone used the normal signup.\nIf that was you, or to take it over, run again with --adopt-existing: this replaces its password.`);
  }
  const password = await askNewPassword();
  let userId = existing?.id;
  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) fail(error.message);
    await removeFactors(existing.id);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email: SUPER_EMAIL, password, email_confirm: true });
    if (error) fail(error.message);
    userId = data.user.id;
  }
  const { error } = await db.rpc('svc_finish_super_bootstrap', { p_user: userId });
  if (error) {
    // Left behind, it would be an ordinary learner account on the reserved address.
    if (!existing) await db.auth.admin.deleteUser(userId);
    fail(error.message);
  }
  console.log(`Super admin ready: ${SUPER_EMAIL}. Log in at /login and scan the QR code.`);
}

async function resetMfa(email) {
  if (!email) fail('Say whose: reset-mfa <email>');
  const { data: userId, error } = await db.rpc('svc_break_glass_mfa', { p_email: email });
  if (error) fail(error.message.includes('not_staff') ? `${email} is not a staff account.` : error.message);
  await removeFactors(userId);
  console.log(`Authenticators removed for ${email}. Their old sessions have stopped working, and the next login shows a new QR code.`);
}

async function resetPassword(email) {
  if (!email) fail('Say whose: reset-password <email>');
  const user = await findUser(email);
  if (!user) fail(`No account for ${email}.`);
  const { error } = await db.auth.admin.updateUserById(user.id, { password: await askNewPassword() });
  if (error) fail(error.message);
  console.log(`Password changed for ${email}.`);
}

const [command, arg] = process.argv.slice(2);
if (command === 'create-super-admin') await createSuperAdmin(arg === '--adopt-existing');
else if (command === 'reset-mfa') await resetMfa(arg);
else if (command === 'reset-password') await resetPassword(arg);
else fail('Commands: create-super-admin [--adopt-existing], reset-mfa <email>, reset-password <email>');
