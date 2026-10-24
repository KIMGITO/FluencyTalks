import { create } from 'zustand';

interface PartnersState {
  partners: import('@/types/db').SavedPartner[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (id: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

export const usePartnersStore = create<PartnersState>((set, get) => ({
  partners: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await import('@/services/library').then((m) => m.listSavedPartners());
      set({ partners: data, loading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to load partners', loading: false });
    }
  },
  save: async (id) => {
    const { partners, save } = get();
    set({ loading: true, error: null });
    try {
      await import('@/services/library').then((m) => m.savePartner(id));
      set({ partners: [...partners, { user_id: '', partner_id: id, created_at: new Date().toISOString() }], loading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to save partner', loading: false });
    }
  },
  delete: async (id) => {
    const { partners, delete: del } = get();
    set({ loading: true, error: null });
    try {
      await import('@/services/library').then((m) => m.deletePartner(id));
      set({ partners: partners?.filter((p) => p.partner_id !== id), loading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to delete partner', loading: false });
    }
  },
}));
