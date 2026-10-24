

export const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000; 

export const SESSION_REVALIDATE_MS = 5 * 60 * 1000; 

export const IDLE_CHECK_MS = 60 * 1000; 

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
    
  }
}

function lsRemove(key: string) {
  mem.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    
  }
}


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


export function touchActivity(now: number = Date.now()) {
  lsSet(ACTIVITY_KEY, String(now));
}

export function getLastActivity(): number | null {
  const raw = lsGet(ACTIVITY_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}


export function isIdleExpired(now: number = Date.now()): boolean {
  const last = getLastActivity();
  if (last == null) return false; 
  return now - last > IDLE_TIMEOUT_MS;
}


export function getStoredUserId(): string | null {
  return lsGet(USER_KEY);
}

export function setStoredUserId(id: string | null) {
  if (id) lsSet(USER_KEY, id);
  else lsRemove(USER_KEY);
}


export function isStaleForUser(currentUserId: string | null): boolean {
  const stored = getStoredUserId();
  return !!stored && !!currentUserId && stored !== currentUserId;
}


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


export function hasPasswordIdentity(user: UserLike | null | undefined): boolean {
  return providersOf(user).some((p) => PASSWORD_PROVIDERS.has(p));
}


export function isOAuthOnly(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  const providers = providersOf(user);
  if (!providers.length) return false; 
  return !providers.some((p) => PASSWORD_PROVIDERS.has(p));
}
