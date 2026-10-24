import { create } from 'zustand';
import { getMyProfile, getMyLanguages, saveProfile, setLanguageProfile } from '@/services';
import { listSavedPartners } from '@/services/library';
import type { MyProfile, UserLanguage, SavedPartner } from '@/types/db';
interface S {
  me: MyProfile | null; languages: UserLanguage[]; savedPartners: SavedPartner[]; status: 'idle' | 'loading' | 'ready';
  load: (id: string) => Promise<void>;
  save: (p: Parameters<typeof saveProfile>[0], languages: Parameters<typeof setLanguageProfile>[0]) => Promise<void>;
  updatePoints: (amount: number) => void;
  reset: () => void;
}
export const useProfileStore = create<S>((set, get) => ({
  me: null, languages: [], savedPartners: [], status: 'idle',
  load: async (id) => {
    if (get().me?.id !== id) set({ status: 'loading' });
    const [me, languages, partners] = await Promise.all([getMyProfile(id), getMyLanguages(id), listSavedPartners()]);
    set({ me, languages, savedPartners: partners ?? [], status: 'ready' });
  },
  save: async (p, languages) => {
    await setLanguageProfile(languages);
    await saveProfile(p);
    await get().load(get().me!.id);
  },
  updatePoints: (amount: number) => set((s) => ({ me: s.me ? { ...s.me, points_balance: (s.me.points_balance || 0) + amount } : null })),
  reset: () => set({ me: null, languages: [], savedPartners: [], status: 'idle' }),
}));
