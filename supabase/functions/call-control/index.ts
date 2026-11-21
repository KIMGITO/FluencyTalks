// Edge Function: hang up or end a call, and close its media room so every device is disconnected, not just told.
// Body: { call_id, action: 'leave' | 'end' }. The database checks who may do what (leave_call, end_call).
// Deploy: supabase functions deploy call-control
import { cors, isUuid, log, refusal, reply, signedIn } from '../_shared/call-http.ts';
import { closeRoom, providerConfigured } from '../_shared/media-provider.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const who = await signedIn(req);
  if (who instanceof Response) return who;
  const body = await req.json().catch(() => ({}));
  if (!isUuid(body?.call_id) || !['leave', 'end'].includes(body?.action)) return reply(400, { error: 'invalid_input' });

  const { error } = await who.asUser.rpc(body.action === 'end' ? 'end_call' : 'leave_call', { p_call: body.call_id });
  if (error) return reply(403, { error: refusal(error.message) });
  const { data: room } = await who.asUser.rpc('call_room_to_close', { p_call: body.call_id });
  if (room && providerConfigured()) {
    try { await closeRoom(room as string); }
    catch (e) { await log('error', 'edge:call-control', `close failed: ${(e as Error).message}`, { call_id: body.call_id }, who.userId); }
  }
  await log('info', 'edge:call-control', body.action, { call_id: body.call_id, closed: !!room }, who.userId);
  return reply(200, { ok: true, ended: !!room });
});
