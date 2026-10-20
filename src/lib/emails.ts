import { DOMAIN } from '@/lib/site';

/**
 * Central contact emails for The Fluency Talks.
 *
 * Every address is read from a `VITE_EMAIL_*` env variable so it can be
 * changed without a code deploy. Each has a safe `@thefluencytalks.com`
 * fallback so the UI never renders an empty address.
 *
 * Already created (per owner): info, security, report, support.
 * Recommended to create next: terms, privacy (legal + GDPR/CCPA requests).
 *
 * Usage:
 *   import { EMAILS, mailto } from '@/lib/emails';
 *   <a href={mailto(EMAILS.support, 'Need help')}>{EMAILS.support}</a>
 */

const pick = (value: unknown, fallback: string): string => {
  const v = typeof value === 'string' ? value.trim() : '';
  return v || fallback;
};

export const EMAILS = {
  /** General enquiries — "Email us info@thefluencytalks.com". */
  info: pick(import.meta.env.VITE_EMAIL_INFO, `info@${DOMAIN}`),
  /** Help, FAQ follow-ups, account help. */
  support: pick(import.meta.env.VITE_EMAIL_SUPPORT, `support@${DOMAIN}`),
  /** Urgent safety / account-compromise reports. */
  security: pick(import.meta.env.VITE_EMAIL_SECURITY, `security@${DOMAIN}`),
  /** Abuse / harassment reports outside the in-app Report button. */
  report: pick(import.meta.env.VITE_EMAIL_REPORT, `report@${DOMAIN}`),
  /** Terms-of-service questions. Recommended inbox to create. */
  terms: pick(import.meta.env.VITE_EMAIL_TERMS, `terms@${DOMAIN}`),
  /** Privacy / GDPR / CCPA / data-deletion requests. Recommended inbox to create. */
  privacy: pick(import.meta.env.VITE_EMAIL_PRIVACY, `privacy@${DOMAIN}`),
} as const;

export type EmailKey = keyof typeof EMAILS;

/** Build a `mailto:` link that opens the user's mail app on click. */
export function mailto(
  email: string,
  opts?: { subject?: string; body?: string },
): string {
  const params = new URLSearchParams();
  if (opts?.subject) params.set('subject', opts.subject);
  if (opts?.body) params.set('body', opts.body);
  const query = params.toString();
  return `mailto:${email}${query ? `?${query}` : ''}`;
}
