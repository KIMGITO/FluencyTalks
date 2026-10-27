// Pure helpers for the auth flow: no imports, so they can be tested without a browser or Supabase.

export interface LandingInfo {
  /** The page was opened from a password-reset email link. */
  recovery: boolean;
  /** Why the link did not work (already used or expired), as reported in the URL. */
  linkError: string | null;
}

/**
 * Reads what the URL says about a password-reset link. Supabase puts the result in the hash
 * (`#access_token=…&type=recovery`, or `#error=access_denied&error_code=otp_expired&…`) or, with the
 * PKCE flow, in the query string (`?code=…`).
 */
export function parseLanding(hash: string, search: string, pathname: string): LandingInfo {
  const params = new URLSearchParams(`${hash.replace(/^#/, '')}&${search.replace(/^\?/, '')}`);
  const description = params.get('error_description');
  const linkError = description ? description.replace(/\+/g, ' ') : params.get('error') ? 'Link is invalid or has expired' : null;
  const recovery = !linkError && (params.get('type') === 'recovery'
    || (pathname === '/reset-password' && (params.has('code') || params.has('access_token'))));
  return { recovery, linkError };
}

/** Auth errors come back as English sentences from the server; show something a person can act on. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('auth session missing')) return 'This reset link has expired or was already used. Request a new one.';
  if (m.includes('different from the old password')) return 'Choose a password you have not used before.';
  if (m.includes('at least') && m.includes('character')) return 'Use at least 8 characters.';
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  if (m.includes('already registered')) return 'An account with this email already exists. Log in instead.';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'Enter a valid email address.';
  return message;
}
