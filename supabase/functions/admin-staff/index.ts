// Edge Function: the staff actions that need the service role or the mailer. Who may do what is decided by the
// database, from the caller's own token (the admin_* functions it calls first), so MFA applies here too.
// Deploy: supabase functions deploy admin-staff
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://thefluencytalks.com';

/** The code a database function raised, if it is one the page knows how to explain. */
const CODES = ['forbidden', 'invalid_email', 'invalid_tier', 'reserved_email', 'already_staff', 'reason_required', 'recovery_locked'];
const dbError = async (message: string) => {
  const code = CODES.find((c) => message.includes(c));
  if (!code) await logFailure('database', message);   // not a refusal: something actually went wrong
  return reply(code === 'forbidden' ? 403 : code ? 400 : 500, { error: code ?? 'failed' });
};

const removeFactors = async (userId: string) => {
  const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
  if (error) throw error;
  for (const f of data?.factors ?? []) {
    const { error: delErr } = await service.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (delErr) throw delErr;
  }
};

const logFailure = (action: string, err: unknown) => service.from('app_logs').insert({
  level: 'error', source: 'edge:admin-staff', message: `${action}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 1000),
});

const probeOnce = async (path: string) => {
  const started = Date.now();
  try {
    const res = await fetch(`${url}${path}`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, signal: AbortSignal.timeout(5000) });
    await res.body?.cancel();
    return { ok: res.status < 500, status: res.status, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - started };
  }
};
// One retry: a single slow answer should not put "Down" on the health page.
const probe = async (name: string, path: string) => {
  const first = await probeOnce(path);
  return { name, ...(first.ok ? first : await probeOnce(path)) };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization');
  if (!auth) return reply(401, { error: 'not_authenticated' });
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who, error: whoErr } = await asUser.auth.getUser();
  if (whoErr || !who.user) return reply(401, { error: 'not_authenticated' });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  try {
    if (action === 'invite') {
      const { data, error } = await asUser.rpc('admin_create_invitation', { p_email: body.email, p_tier: body.tier ?? 'admin' });
      if (error) return dbError(error.message);
      const redirectTo = `${SITE_URL}/admin/accept-invite?token=${data.token}`;
      // A person who already has an account gets a sign-in link instead: the invite API refuses existing addresses.
      const { error: mailErr } = data.existing_user
        ? await createClient(url, anonKey, { auth: { persistSession: false } }).auth.signInWithOtp({ email: data.email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
        : await service.auth.admin.inviteUserByEmail(data.email, { redirectTo });
      if (mailErr) {
        await asUser.rpc('admin_revoke_invitation', { p_id: data.id });
        await logFailure(action, mailErr);
        return reply(502, { error: 'email_failed' });
      }
      return reply(200, { ok: true, email: data.email });
    }

    if (action === 'reset_mfa') {
      const { error } = await asUser.rpc('admin_prepare_mfa_reset', { p_user: body.user_id, p_reason: body.reason });
      if (error) return dbError(error.message);
      await removeFactors(body.user_id);
      return reply(200, { ok: true });
    }

    if (action === 'remove_staff') {
      const { error } = await asUser.rpc('admin_remove_staff', { p_user: body.user_id, p_reason: body.reason });
      if (error) return dbError(error.message);
      await removeFactors(body.user_id);   // they are a learner again, and learners do not have factors
      return reply(200, { ok: true });
    }

    if (action === 'redeem_recovery') {
      const { data, error } = await asUser.rpc('admin_redeem_recovery_code', { p_code: body.code });
      if (error) return dbError(error.message);
      if (!data) return reply(400, { error: 'recovery_code_invalid' });
      await removeFactors(who.user.id);
      return reply(200, { ok: true });
    }

    if (action === 'probe') {
      const { error } = await asUser.rpc('staff_assert', { p_level: 'full' });
      if (error) return dbError(error.message);
      const services = await Promise.all([probe('Auth', '/auth/v1/health'), probe('Database API', '/rest/v1/languages?select=id&limit=1'), probe('Storage', '/storage/v1/version')]);
      for (const s of services) if (!s.ok) await logFailure('probe', `${s.name} answered ${s.status}`);
      return reply(200, {
        services: [{ name: 'Edge functions', ok: true, status: 200, ms: 0 }, ...services],
        secrets: { web_push: !!Deno.env.get('VAPID_PRIVATE_KEY'), unsplash: !!Deno.env.get('UNSPLASH_ACCESS_KEY') },
      });
    }
    return reply(400, { error: 'unknown_action' });
  } catch (err) {
    await logFailure(action, err);
    return reply(500, { error: 'failed' });
  }
});
