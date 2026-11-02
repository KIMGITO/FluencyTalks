import { create } from 'zustand';
import { adminOverview, type AdminOverview } from '@/services/admin';

interface S { overview: AdminOverview | null; failed: boolean; refresh: () => Promise<void>; reset: () => void }

/** The admin counts: the Overview page and the nav badges read the same numbers. Refreshed on each page change and after a moderation action. */
export const useAdminStore = create<S>((set) => ({
  overview: null,
  failed: false,
  refresh: async () => {
    try { set({ overview: await adminOverview(), failed: false }); }
    catch { set({ failed: true }); }   // the badges keep their last numbers; Overview shows the failure if it has nothing to show
  },
  reset: () => set({ overview: null, failed: false }),
}));

export const refreshAdminCounts = () => useAdminStore.getState().refresh();
