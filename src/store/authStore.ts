import { create } from 'zustand';
import type { Session, User, Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null; session: Session | null; loading: boolean; error: string | null;
  init: () => Promise<void>;
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
// Auth redirects must never fall back to localhost: a stale dashboard allow-list plus a
// server-side (window-less) call would otherwise bounce production logins back to :3000.
const PROD_ORIGIN = 'https://fluency-talks.vercel.app';
const origin = () => (typeof window !== 'undefined' ? window.location.origin : PROD_ORIGIN);
export const useAuthStore = create<AuthState>((set) => ({
  user: null, session: null, loading: true, error: null,
  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false });
    supabase.auth.onAuthStateChange((_e, s) => set({ session: s, user: s?.user ?? null }));
  },
  signUp: (email, password) => run(set, () => supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/home` } })),
  signIn: (email, password) => run(set, () => supabase.auth.signInWithPassword({ email, password })),
  signInWithProvider: async (provider) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin()}/home` },
    });
    if (error) set({ error: error.message });
  },
  signOut: async () => { await supabase.auth.signOut(); },
  sendPasswordReset: (email) => run(set, () => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` })),
  updatePassword: (password) => run(set, () => supabase.auth.updateUser({ password })),
  updateEmail: (email) => run(set, () => supabase.auth.updateUser({ email })),
}));
