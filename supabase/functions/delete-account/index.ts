// Edge Function: permanently deletes the calling user (needs the service role, so it cannot run in the browser).
// Deploy: supabase functions deploy delete-account
// Portable alternative: a small authenticated endpoint on your own backend that calls the same admin API.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization');
  if (!auth) return reply(401, { error: 'not_authenticated' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return reply(401, { error: 'not_authenticated' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const uid = data.user.id;

  const { data: files } = await admin.storage.from('avatars').list(uid);
  if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${uid}/${f.name}`));

  // Cascades remove profile, languages, follows, blocks, messages, notifications, etc.
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return reply(500, { error: delErr.message });
  return reply(200, { ok: true });
});
