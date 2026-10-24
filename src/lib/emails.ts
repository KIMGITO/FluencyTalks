import { DOMAIN } from '@/lib/site';



const pick = (value: unknown, fallback: string): string => {
  const v = typeof value === 'string' ? value.trim() : '';
  return v || fallback;
};

export const EMAILS = {
  
  info: pick(import.meta.env.VITE_EMAIL_INFO, `info@${DOMAIN}`),
  
  support: pick(import.meta.env.VITE_EMAIL_SUPPORT, `support@${DOMAIN}`),
  
  security: pick(import.meta.env.VITE_EMAIL_SECURITY, `security@${DOMAIN}`),
  
  report: pick(import.meta.env.VITE_EMAIL_REPORT, `report@${DOMAIN}`),
  
  terms: pick(import.meta.env.VITE_EMAIL_TERMS, `terms@${DOMAIN}`),
  
  privacy: pick(import.meta.env.VITE_EMAIL_PRIVACY, `privacy@${DOMAIN}`),
} as const;

export type EmailKey = keyof typeof EMAILS;


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
