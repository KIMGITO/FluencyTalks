// Edge Function: delivers one notifications row to the owner's subscribed devices. Called by the database
// (trg_push_notification) after the row commits, never by a browser.
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… PUSH_WEBHOOK_SECRET=…
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { hasActor, notificationLink, notificationVerb } from '../_shared/notification-text.ts';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return reply(401, { error: 'forbidden' });
  const { notification_id: id } = await req.json().catch(() => ({ notification_id: null }));
  if (!id) return reply(400, { error: 'notification_id required' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // The claim is what makes a retry harmless: only one call ever gets the row back.
  const { data: rows, error } = await db.from('notifications').update({ push_claimed_at: new Date().toISOString() })
    .eq('id', id).is('push_claimed_at', null).select('*');
  if (error) return reply(500, { error: error.message });
  const n = rows?.[0];
  if (!n) return reply(200, { skipped: 'already sent' });

  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', n.user_id);
  if (!subs?.length) return reply(200, { sent: 0 });
  const { data: actor } = n.actor_id ? await db.from('profiles').select('display_name, username').eq('id', n.actor_id).maybeSingle() : { data: null };

  const verb = notificationVerb({ ...n, actor_username: actor?.username });
  const payload = JSON.stringify({
    title: hasActor(n) ? (actor?.display_name || actor?.username || 'The Fluency Talks') : 'The Fluency Talks',
    body: verb,
    url: notificationLink({ ...n, actor_username: actor?.username }),
    tag: n.data?.post_id ? `post:${n.data.post_id}` : `n:${n.id}`,
  });

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 });
      sent += 1;
      await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', s.id);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Gone for good (uninstalled, permission revoked): stop trying. Anything else may be temporary.
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push failed', status, (e as Error).message);
    }
  }));
  return reply(200, { sent });
});
