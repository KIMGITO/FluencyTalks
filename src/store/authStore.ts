import { create } from 'zustand';
import type { Session, User, Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError, parseLanding, type LandingInfo } from '@/lib/authHelpers';
import {
  IDLE_CHECK_MS,
  SESSION_REVALIDATE_MS,
  clearSessionMarkers,
  getDeviceId,
  getLastActivity,
  isIdleExpired,
  isOAuthOnly,
  isStaleForUser,
  setStoredUserId,
  touchActivity,
} from '@/lib/session';

interface AuthState {
  user: User | null; session: Session | null; loading: boolean; error: string | null;
  sessionCheckedAt: number | null;
  forceLogoutReason: 'idle' | 'invalid' | 'switched' | null;
  /** The page was opened from a password-reset email link, so this session is a recovery session. */
  recovery: boolean;
  /** Set when the email link was already used or has expired (Supabase puts the reason in the URL). */
  recoveryLinkError: string | null;
  clearError: () => void;
  init: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithProvider: (p: Extract<Provider, 'google' | 'apple' | 'facebook'>) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  updateEmail: (email: string) => Promise<boolean>;
}
const run = async (set: (s: Partial<AuthState>) => void, fn: () => Promise<{ error: { message: string } | null }>) => {
  set({ error: null }); const { error } = await fn();
  if (error) set({ error: friendlyAuthError(error.message) });
  return !error;
};

/**
 * What the URL said when the page loaded. This must be read synchronously at load: the Supabase
 * client consumes and rewrites the URL hash a moment later, and its PASSWORD_RECOVERY event can
 * fire before our listener is registered.
 */
const landing = (() => {
  if (typeof window === 'undefined') return { recovery: false, linkError: null as string | null };
  const { hash, search, pathname } = window.location;
  const params = new URLSearchParams(`${hash.replace(/^#/, '')}&${search.replace(/^\?/, '')}`);
  const linkError = params.get('error_description') ?? (params.get('error') ? 'Link is invalid or has expired' : null);
  const recovery = !linkError && (params.get('type') === 'recovery'
    || (pathname === '/reset-password' && (params.has('code') || params.has('access_token'))));
  return { recovery, linkError };
})();
const PROD_ORIGIN = 'https://thefluencytalks.com';
const origin = () => (typeof window !== 'undefined' ? window.location.origin : PROD_ORIGIN);

async function resetUserCaches() {
  try {
    const [{ useProfileStore }, { useChatStore }, { useNotificationStore }] = await Promise.all([
      import('@/store/profileStore'),
      import('@/store/chatStore'),
      import('@/store/notificationStore'),
    ]);
    useProfileStore.getState().reset();
    try { useChatStore.getState().stopRealtime(); } catch { }
    try { useNotificationStore.getState().stop(); } catch { }
  } catch {
  }
}

let initialized = false;
export const useAuthStore = create<AuthState>((set, get) => {
  const forceLogout = async (reason: AuthState['forceLogoutReason']) => {
    clearSessionMarkers();
    await resetUserCaches();
    try { await supabase.auth.signOut(); } catch { }
    set({ user: null, session: null, loading: false, sessionCheckedAt: Date.now(), forceLogoutReason: reason });
  };

  const adoptSession = async (s: Session | null) => {
    const user = s?.user ?? null;
    if (!user) {
      if (get().user) await forceLogout('invalid');
      else { clearSessionMarkers(); set({ user: null, session: null, loading: false }); }
      return;
    }
    // A recovery session is brand new: the idle marker left in this browser from an old visit must not sign it out.
    if (get().recovery) touchActivity();
    else if (isIdleExpired()) { await forceLogout('idle'); return; }
    if (isStaleForUser(user.id)) {
      await resetUserCaches();
      set({ forceLogoutReason: 'switched' });
    } else {
      set({ forceLogoutReason: null });
    }
    setStoredUserId(user.id);
    touchActivity();
    set({ user, session: s, loading: false, sessionCheckedAt: Date.now() });
  };

  return {
  user: null, session: null, loading: true, error: null, sessionCheckedAt: null, forceLogoutReason: null,
  recovery: landing.recovery, recoveryLinkError: landing.linkError,
  clearError: () => set({ error: null }),
  init: async () => {
    if (initialized) return;
    initialized = true;
    getDeviceId();
    if (typeof window !== 'undefined' && !getLastActivity()) touchActivity();
    const { data } = await supabase.auth.getSession();
    await adoptSession(data.session);
    supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') { touchActivity(); set({ recovery: true }); }
      if (event === 'SIGNED_OUT' || !s) {
        clearSessionMarkers();
        await resetUserCaches();
        set({ user: null, session: null, loading: false, sessionCheckedAt: Date.now() });
        return;
      }
      await adoptSession(s);
    });
    if (typeof window !== 'undefined') {
      const markActive = () => { if (get().user) touchActivity(); };
      for (const evt of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
        window.addEventListener(evt, markActive, { passive: true });
      }
      window.addEventListener('focus', markActive);
      window.setInterval(async () => {
        if (get().user && isIdleExpired()) await forceLogout('idle');
      }, IDLE_CHECK_MS);
      window.setInterval(() => { void get().validateSession(); }, SESSION_REVALIDATE_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void get().validateSession();
      });
    }
  },
  validateSession: async () => {
    if (!get().user) return false;
    if (isIdleExpired()) { await forceLogout('idle'); return false; }
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) { await forceLogout('invalid'); return false; }
      if (isStaleForUser(data.user.id)) {
        await resetUserCaches();
        setStoredUserId(data.user.id);
        touchActivity();
        const { data: sess } = await supabase.auth.getSession();
        set({ user: data.user as User, session: sess.session, sessionCheckedAt: Date.now(), forceLogoutReason: 'switched' });
        return true;
      }
      touchActivity();
      set({ sessionCheckedAt: Date.now() });
      return true;
    } catch {
      return !!get().user;
    }
  },
  signUp: async (email, password) => {
    const ok = await run(set, () => supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/home` } }));
    if (ok) {
      await resetUserCaches();
      setStoredUserId(get().user?.id ?? null);
      touchActivity();
    }
    return ok;
  },
  signIn: async (email, password) => {
    const ok = await run(set, () => supabase.auth.signInWithPassword({ email, password }));
    if (ok) {
      const s = (await supabase.auth.getSession()).data.session;
      await adoptSession(s);
    }
    return ok;
  },
  signInWithProvider: async (provider) => {
    set({ error: null });
    touchActivity();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin()}/home` },
    });
    if (error) set({ error: error.message });
  },
  signOut: async () => {
    clearSessionMarkers();
    await resetUserCaches();
    await supabase.auth.signOut();
    set({ user: null, session: null, forceLogoutReason: null });
  },
  sendPasswordReset: (email) => run(set, () => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` })),
  updatePassword: async (password) => {
    if (isOAuthOnly(get().user)) {
      set({ error: 'This account signs in with Google. Use Google to log in — no password to change here.' });
      return false;
    }
    const ok = await run(set, () => supabase.auth.updateUser({ password }));
    if (ok) set({ recovery: false });
    return ok;
  },
  updateEmail: (email) => run(set, () => supabase.auth.updateUser({ email })),
  };
});
