// Edge Function: the media provider's signed events (participant joined/left, room finished). Not called by browsers.
// Each event is verified against our API secret, then applied once (apply_call_provider_event dedupes by event id).
// Deploy: supabase functions deploy livekit-webhook --no-verify-jwt   (then set this URL as the webhook in LiveKit Cloud)
import { admin, log } from '../_shared/call-http.ts';
import { removeFromRoom, verifyEvent } from '../_shared/media-provider.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const body = await req.text();
  if (body.length > 65_536) return json(413, { error: 'too_large' });
  let ev;
  try { ev = await verifyEvent(body, req.headers.get('Authorization')); }
  catch (e) { await log('warn', 'edge:livekit-webhook', 'bad signature', { reason: String((e as Error).message).slice(0, 200) }); return json(401, { error: 'invalid_signature' }); }
  if (!ev.id || !ev.room) return json(200, { result: 'ignored' });

  const { data, error } = await admin().rpc('apply_call_provider_event', { p_event_id: ev.id, p_event: ev.event, p_room: ev.room, p_identity: ev.identity });
  if (error) {
    await log('error', 'edge:livekit-webhook', error.message, { event: ev.event, event_id: ev.id });
    return json(500, { error: 'failed' });   // the provider retries
  }
  // Someone in the room who has no right to be: take them out.
  if (data?.result === 'not_allowed' && ev.identity) await removeFromRoom(ev.room, ev.identity).catch(() => undefined);
  return json(200, data);
});
