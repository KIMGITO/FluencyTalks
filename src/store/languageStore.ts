import { create } from 'zustand';
import { listLanguages } from '@/services';
import type { LanguageRef } from '@/types/db';
interface S { list: LanguageRef[]; load: () => Promise<void>; name: (code: string) => string }
export const useLanguageStore = create<S>((set, get) => ({
  list: [],
  load: async () => { if (!get().list.length) set({ list: await listLanguages() }); },
  name: (code) => get().list.find((l) => l.code === code)?.name ?? code,
}));
