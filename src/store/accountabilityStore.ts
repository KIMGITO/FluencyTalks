import { create } from 'zustand';
import { getMyAccountability, type Accountability } from '@/services/review';

/** What the signed-in person owes. Shared by Home, Notifications and the post form. */
export const useAccountabilityStore = create<{ data: Accountability | null; failed: boolean; load: () => Promise<void> }>((set) => ({
  data: null, failed: false,
  load: async () => {
    try { set({ data: await getMyAccountability(), failed: false }); }
    catch { set({ failed: true }); }
  },
}));
