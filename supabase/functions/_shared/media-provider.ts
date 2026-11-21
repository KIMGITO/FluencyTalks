// The only server file that knows which media provider we use. Swap the provider here and the call lifecycle,
// database and UI stay as they are. Secrets: supabase secrets set LIVEKIT_URL=… LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=…
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from 'npm:livekit-server-sdk@2.19.2';

declare const Deno: { env: { get(name: string): string | undefined } };

export interface ProviderEvent { id: string; event: string; room: string | null; identity: string | null }

const env = () => {
  const url = Deno.env.get('LIVEKIT_URL'); const key = Deno.env.get('LIVEKIT_API_KEY'); const secret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!url || !key || !secret) throw new Error('media provider is not configured');
  return { url, key, secret };
};

export const providerConfigured = () => { try { env(); return true; } catch { return false; } };
export const providerUrl = () => env().url;

/**
 * A short-lived token for one room, as one identity: camera and microphone only, no data, no admin, no recording.
 * `voiceOnly` (a call with a member under 16) leaves the camera out, so the provider refuses any video.
 */
export async function issueToken(room: string, identity: string, ttlSeconds: number, voiceOnly: boolean): Promise<string> {
  const { key, secret } = env();
  const at = new AccessToken(key, secret, { identity, ttl: ttlSeconds });
  at.addGrant({
    room, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: false, canUpdateOwnMetadata: false,
    canPublishSources: voiceOnly ? [TrackSource.MICROPHONE] : [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return at.toJwt();
}

const rooms = () => { const { url, key, secret } = env(); return new RoomServiceClient(url.replace(/^wss:/, 'https:'), key, secret); };

/** Disconnects everyone. A room that never opened or already closed is fine. */
export async function closeRoom(room: string): Promise<void> {
  try { await rooms().deleteRoom(room); } catch (e) { if (!/not.?found|404/i.test(String((e as Error).message))) throw e; }
}

export async function removeFromRoom(room: string, identity: string): Promise<void> {
  try { await rooms().removeParticipant(room, identity); } catch (e) { if (!/not.?found|404/i.test(String((e as Error).message))) throw e; }
}

/** Throws unless the body is signed by our provider account. */
export async function verifyEvent(body: string, authorization: string | null): Promise<ProviderEvent> {
  const { key, secret } = env();
  const ev = await new WebhookReceiver(key, secret).receive(body, authorization ?? undefined);
  return { id: ev.id, event: ev.event, room: ev.room?.name ?? null, identity: ev.participant?.identity ?? null };
}
