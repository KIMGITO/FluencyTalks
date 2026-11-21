// Shared by the call functions: CORS, replies, the signed-in user, and privacy-safe logs (never a token or secret).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { edgeGate } from './edge-gate.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export async function log(level: 'info' | 'warn' | 'error', source: string, message: string, context: Record<string, unknown>, userId?: string) {
  await admin().from('app_logs').insert({ level, source, message: message.slice(0, 500), context, user_id: userId ?? null }).then(() => undefined, () => undefined);
}

/** The verified caller and a client that acts as them, or a reply to send back. */
export async function signedIn(req: Request): Promise<{ userId: string; asUser: ReturnType<typeof createClient> } | Response> {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const auth = req.headers.get('Authorization');
  if (!auth) return reply(401, { error: 'not_authenticated' });
  const url = Deno.env.get('SUPABASE_URL')!; const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return reply(401, { error: 'not_authenticated' });
  const refused = await edgeGate(url, anon, auth);
  if (refused) return reply(refused, { error: refused === 429 ? 'rate_limited' : 'app_paused' });
  return { userId: data.user.id, asUser };
}

/** Database refusals are short codes; anything else becomes a generic failure. */
export const refusal = (message: string) => (/^[a-z_]{3,40}$/.test(message) ? message : 'failed');
