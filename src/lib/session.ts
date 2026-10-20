/**
 * Session + device helpers. Single place for the rules the auth flow enforces:
 * - a device idle for 24h must force-logout (client-enforced, Supabase has no
 *   server-side idle timeout for browser sessions),
 * - every device re-validates its session against the server (so a deletion on
 *   one device logs out the others, and a re-created account never reuses a
 *   stale session),
 * - password setting is only for email/password identities (OAuth accounts
 *   must not see a "set password" path).
 */

export const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
/** How often the app re-confirms the session with the server. */
export const SESSION_REVALIDATE_MS = 5 * 60 * 1000; // 5 minutes
/** How often the idle deadline is checked while the tab is open. */
export const IDLE_CHECK_MS = 60 * 1000; // 1 minute

const DEVICE_KEY = 'ft-device-id';
const ACTIVITY_KEY = 'ft-last-activity';
const USER_KEY = 'ft-auth-user-id';

const mem = new Map<string, string>();

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return mem.get(key) ?? null;
  }
}

function lsSet(key: string, value: string) {
  mem.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: memory fallback */
  }
}

function lsRemove(key: string) {
  mem.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Stable per-device id, created once and reused for heartbeats / debugging. */
export function getDeviceId(): string {
  let id = lsGet(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    lsSet(DEVICE_KEY, id);
  }
  return id;
}

/** Record "the user just did something on this device". */
export function touchActivity(now: number = Date.now()) {
  lsSet(ACTIVITY_KEY, String(now));
}

export function getLastActivity(): number | null {
  const raw = lsGet(ACTIVITY_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** True when this device has been idle longer than the 24h limit. */
export function isIdleExpired(now: number = Date.now()): boolean {
  const last = getLastActivity();
  if (last == null) return false; // never recorded -> do not force logout yet
  return now - last > IDLE_TIMEOUT_MS;
}

/** Remember which auth user id owns this browser state. */
export function getStoredUserId(): string | null {
  return lsGet(USER_KEY);
}

export function setStoredUserId(id: string | null) {
  if (id) lsSet(USER_KEY, id);
  else lsRemove(USER_KEY);
}

/**
 * True when the stored browser state belongs to a DIFFERENT user than the
 * current session. That happens when an account was deleted and the same
 * email signed up again (Supabase issues a brand-new user id): the old
 * device must throw away the stale profile/chat state and start fresh.
 */
export function isStaleForUser(currentUserId: string | null): boolean {
  const stored = getStoredUserId();
  return !!stored && !!currentUserId && stored !== currentUserId;
}

/** Clear per-login browser markers (keeps the device id itself). */
export function clearSessionMarkers() {
  lsRemove(ACTIVITY_KEY);
  lsRemove(USER_KEY);
}

interface IdentityLike {
  provider?: string;
  identity_data?: Record<string, unknown> | null;
}

interface UserLike {
  id?: string;
  app_metadata?: { providers?: string[] } | null;
  identities?: IdentityLike[] | null;
}

/** Providers that mean "this identity logs in with a password". */
const PASSWORD_PROVIDERS = new Set(['email']);

function providersOf(user: UserLike | null | undefined): string[] {
  if (!user) return [];
  const fromIdentities = (user.identities ?? [])
    .map((i) => (i.provider ?? '').toLowerCase())
    .filter(Boolean);
  if (fromIdentities.length) return fromIdentities;
  const fromMeta = (user.app_metadata?.providers ?? []).map((p) =>
    String(p).toLowerCase(),
  );
  return fromMeta;
}

/** True when the account can sign in with email + password. */
export function hasPasswordIdentity(user: UserLike | null | undefined): boolean {
  return providersOf(user).some((p) => PASSWORD_PROVIDERS.has(p));
}

/**
 * True when the account was created via an OAuth/email-link provider and has
 * NO password identity (Google/Apple/Facebook-only). Those accounts must not
 * be offered a "set/change password" path — it would fail or create a second
 * credential the user did not ask for.
 */
export function isOAuthOnly(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  const providers = providersOf(user);
  if (!providers.length) return false; // unknown -> allow, server decides
  return !providers.some((p) => PASSWORD_PROVIDERS.has(p));
}
