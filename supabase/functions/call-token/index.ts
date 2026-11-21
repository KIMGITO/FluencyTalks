// Edge Function: a media token for one call, for the signed-in member only. The database decides (claim_call_join:
// identity, call state, invitation, blocks, capacity); this function only signs. The token is never stored or logged.
// Deploy: supabase functions deploy call-token
import { cors, isUuid, log, refusal, reply, signedIn } from '../_shared/call-http.ts';
import { issueToken, providerConfigured, providerUrl } from '../_shared/media-provider.ts';

const STATUS: Record<string, number> = { rate_limited: 429, calls_disabled: 503, call_unavailable: 403 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const who = await signedIn(req);
  if (who instanceof Response) return who;
  if (!providerConfigured()) return reply(503, { error: 'calls_disabled' });
  const body = await req.json().catch(() => ({}));
  if (!isUuid(body?.call_id)) return reply(400, { error: 'invalid_input' });

  const { data, error } = await who.asUser.rpc('claim_call_join', { p_call: body.call_id });
  if (error) return reply(403, { error: refusal(error.message) });
  if (!data?.ok) {
    await log('warn', 'edge:call-token', 'join refused', { call_id: body.call_id, code: data?.code }, who.userId);
    return reply(STATUS[data?.code] ?? 403, { error: data?.code ?? 'call_unavailable' });
  }
  // The database returns the caller's own id; check it anyway, so a bug there can never mint someone else's identity.
  if (data.identity !== who.userId) return reply(403, { error: 'call_unavailable' });
  try {
    const voiceOnly = data.voice_only !== false;   // fails closed: anything but an explicit false means no camera
    const token = await issueToken(data.room, data.identity, data.ttl, voiceOnly);
    await log('info', 'edge:call-token', 'token issued', { call_id: data.call_id }, who.userId);
    return reply(200, { token, url: providerUrl(), expires_in: data.ttl, voice_only: voiceOnly });
  } catch (e) {
    await log('error', 'edge:call-token', `token failed: ${(e as Error).message}`, { call_id: data.call_id }, who.userId);
    return reply(500, { error: 'failed' });
  }
});
