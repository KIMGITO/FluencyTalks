import { create } from 'zustand';
import { getMyProfile, getMyLanguages, saveProfile, setLanguageProfile } from '@/services';
import type { MyProfile, UserLanguage } from '@/types/db';
interface S {
  me: MyProfile | null; languages: UserLanguage[]; status: 'idle' | 'loading' | 'ready';
  load: (id: string) => Promise<void>;
  save: (p: Parameters<typeof saveProfile>[0], languages: Parameters<typeof setLanguageProfile>[0]) => Promise<void>;
  updatePoints: (amount: number) => void;
  reset: () => void;
}
export const useProfileStore = create<S>((set, get) => ({
  me: null, languages: [], status: 'idle',
  load: async (id) => {
    if (get().me?.id !== id) set({ status: 'loading' });
    const [me, languages] = await Promise.all([getMyProfile(id), getMyLanguages(id)]);
    set({ me, languages, status: 'ready' });
  },
  save: async (p, languages) => {
    await setLanguageProfile(languages);   // languages first: onboarding completes once a username AND a native language exist
    await saveProfile(p);
    await get().load(get().me!.id);
  },
  updatePoints: (amount: number) => set((s) => ({ me: s.me ? { ...s.me, points_balance: (s.me.points_balance || 0) + amount } : null })),
  reset: () => set({ me: null, languages: [], status: 'idle' }),
}));
