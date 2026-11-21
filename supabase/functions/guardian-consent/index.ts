// Edge Function: a parent or guardian's agreement for a member aged 12 to 15. Spec: docs/LEARNING_PATH.md §Age.
//   { action: 'request', guardian_name, relationship, guardian_email }  signed in as the child: emails the guardian a link
//   { action: 'view', token }                                          signed out: what the consent page shows
//   { action: 'decide', token, decision: 'confirm'|'decline'|'withdraw', name?, adult? }   signed out: the guardian's answer
// A decline or a withdrawal deletes the child's account at once. If that fails the account stays shut (the request
// gate refuses 'guardian_declined') and the error is logged for staff.
// The token only ever travels in the email, so a child can't agree on their own behalf. The database stores its hash.
// Secrets: RESEND_API_KEY, GUARDIAN_EMAIL_FROM (e.g. "The Fluency Talks <consent@thefluencytalks.com>"), PUBLIC_SITE_URL.
// Deploy: supabase functions deploy guardian-consent   (verify_jwt = false in config.toml: the guardian has no account)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { admin, cors, log, refusal, reply } from '../_shared/call-http.ts';
import { deleteUserAndFiles } from '../_shared/delete-user.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Response | Promise<Response>): void };

const RELATION: Record<string, string> = { mother: 'mother', father: 'father', legal_guardian: 'legal guardian', other_relative_guardian: 'relative with legal responsibility' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const isToken = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('GUARDIAN_EMAIL_FROM'), to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`email provider answered ${res.status}`);
}

async function request(req: Request, body: Record<string, unknown>) {
  const auth = req.headers.get('Authorization');
  if (!auth) return reply(401, { error: 'not_authenticated' });
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await asUser.auth.getUser();
  if (ue || !u.user) return reply(401, { error: 'not_authenticated' });
  const site = Deno.env.get('PUBLIC_SITE_URL');
  if (!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('GUARDIAN_EMAIL_FROM') || !site) return reply(503, { error: 'email_unavailable' });

  const { data, error } = await admin().rpc('svc_guardian_request', {
    p_child: u.user.id, p_name: String(body.guardian_name ?? ''), p_relationship: String(body.relationship ?? ''), p_email: String(body.guardian_email ?? ''),
  });
  if (error) return reply(400, { error: refusal(error.message) });
  const r = data as { request_id: string; token: string; email: string; guardian_name: string; child_name: string; child_age: number };
  const link = `${site.replace(/\/$/, '')}/guardian?token=${r.token}`;
  const child = r.child_name || 'Your child';
  const subject = `${child} would like your permission to use The Fluency Talks`;
  const text = `Hello ${r.guardian_name},\n\n${child} (aged ${r.child_age}) has signed up to The Fluency Talks, a community where people practise languages by chatting and calling each other, and named you as their parent or guardian.\n\nBecause they are under 16, they can't use the community until you agree. Calls with members under 16 are voice only, and every member has agreed to strict rules about them. If you refuse, their account and its data are deleted at once. Please read what this means and give or refuse your permission here (the link works for 7 days):\n${link}\n\nIf you agree, you can withdraw your permission later from the same link.\nIf you don't know this person, you can ignore this email: nothing happens without your permission.\n\nThe Fluency Talks`;
  const html = `<p>Hello ${esc(r.guardian_name)},</p><p><strong>${esc(child)}</strong> (aged ${r.child_age}) has signed up to The Fluency Talks, a community where people practise languages by chatting and calling each other, and named you as their parent or guardian.</p><p>Because they are under 16, they can't use the community until you agree. Calls with members under 16 are voice only, and every member has agreed to strict rules about them. If you refuse, their account and its data are deleted at once.</p><p><a href="${esc(link)}">Read what this means and give or refuse your permission</a> (the link works for 7 days).</p><p>If you agree, you can withdraw your permission later from the same link. If you don't know this person, you can ignore this email: nothing happens without your permission.</p><p>The Fluency Talks</p>`;
  try {
    await sendEmail(r.email, subject, html, text);
  } catch (e) {
    await log('error', 'edge:guardian-consent', `send failed: ${(e as Error).message}`, { request_id: r.request_id }, u.user.id);
    return reply(502, { error: 'email_failed' });
  }
  await admin().rpc('svc_guardian_mark_sent', { p_request: r.request_id });
  await log('info', 'edge:guardian-consent', 'requested', { request_id: r.request_id }, u.user.id);
  return reply(200, { sent: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (body.action === 'request') return await request(req, body);
    if (!isToken(body.token)) return reply(400, { error: 'guardian_link_invalid' });
    if (body.action === 'view') {
      const { data, error } = await admin().rpc('svc_guardian_view', { p_token: body.token });
      if (error) return reply(400, { error: refusal(error.message) });
      return data ? reply(200, data) : reply(404, { error: 'guardian_link_invalid' });
    }
    if (body.action === 'decide' && ['confirm', 'decline', 'withdraw'].includes(String(body.decision))) {
      const { data, error } = await admin().rpc('svc_guardian_decide', {
        p_token: body.token, p_decision: body.decision, p_name: typeof body.name === 'string' ? body.name : null, p_adult: body.adult === true,
      });
      if (error) return reply(400, { error: refusal(error.message) });
      const { delete_user: child, ...view } = data as Record<string, unknown>;
      await log('info', 'edge:guardian-consent', `decided:${body.decision}`, {});
      if (typeof child === 'string') {
        const failed = await deleteUserAndFiles(admin(), child);
        if (failed) await log('error', 'edge:guardian-consent', `delete failed: ${failed}`, {}, child);
        return reply(200, { ...view, account_deleted: !failed });
      }
      return reply(200, view);
    }
    return reply(400, { error: 'invalid_input' });
  } catch (e) {
    await log('error', 'edge:guardian-consent', (e as Error).message, {});
    return reply(500, { error: 'failed' });
  }
});
