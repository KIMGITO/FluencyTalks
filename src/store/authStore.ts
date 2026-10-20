import { create } from 'zustand';
import type { Session, User, Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
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
  /** When the session was last confirmed with the server (ms epoch). */
  sessionCheckedAt: number | null;
  /** Set when we forced a logout (idle timeout / deleted elsewhere / user switched). */
  forceLogoutReason: 'idle' | 'invalid' | 'switched' | null;
  init: () => Promise<void>;
  /** Re-confirm the session with the server. Returns false when we logged out. */
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
  if (error) set({ error: error.message });
  return !error;
};
const PROD_ORIGIN = 'https://thefluencytalks.com';
const origin = () => (typeof window !== 'undefined' ? window.location.origin : PROD_ORIGIN);

/** Clear cached per-user client state without importing stores statically (chatStore imports this file). */
async function resetUserCaches() {
  try {
    const [{ useProfileStore }, { useChatStore }, { useNotificationStore }] = await Promise.all([
      import('@/store/profileStore'),
      import('@/store/chatStore'),
      import('@/store/notificationStore'),
    ]);
    useProfileStore.getState().reset();
    try { useChatStore.getState().stopRealtime(); } catch { /* not started */ }
    try { useNotificationStore.getState().stop(); } catch { /* not started */ }
  } catch {
    /* stores not loaded yet — nothing cached */
  }
}

let initialized = false;
export const useAuthStore = create<AuthState>((set, get) => {
  /** Force-logout on this device and wipe stale per-user state. */
  const forceLogout = async (reason: AuthState['forceLogoutReason']) => {
    clearSessionMarkers();
    await resetUserCaches();
    try { await supabase.auth.signOut(); } catch { /* already signed out */ }
    set({ user: null, session: null, loading: false, sessionCheckedAt: Date.now(), forceLogoutReason: reason });
  };

  /** Adopt a fresh session: handle user-switch (deleted + re-created), stamp activity. */
  const adoptSession = async (s: Session | null) => {
    const user = s?.user ?? null;
    if (!user) {
      if (get().user) await forceLogout('invalid');
      else { clearSessionMarkers(); set({ user: null, session: null, loading: false }); }
      return;
    }
    if (isIdleExpired()) { await forceLogout('idle'); return; }
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
  init: async () => {
    if (initialized) return;
    initialized = true;
    getDeviceId();
    if (typeof window !== 'undefined' && !getLastActivity()) touchActivity();
    const { data } = await supabase.auth.getSession();
    await adoptSession(data.session);
    supabase.auth.onAuthStateChange(async (event, s) => {
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
    return run(set, () => supabase.auth.updateUser({ password }));
  },
  updateEmail: (email) => run(set, () => supabase.auth.updateUser({ email })),
  };
});
