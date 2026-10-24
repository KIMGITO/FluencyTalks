import { useEffect } from 'react';
import { create } from 'zustand';
import { listCountries } from '@/services';
import type { Country } from '@/types/db';

interface S { list: Country[]; load: () => void }
let inflight: Promise<void> | null = null;

export const useCountryStore = create<S>((set, get) => ({
  list: [],
  load: () => {
    if (get().list.length || inflight) return;
    inflight = listCountries().then((list) => { if (list.length) set({ list }); }).finally(() => { inflight = null; });
  },
}));

export const useCountries = (): Country[] => {
  const list = useCountryStore((s) => s.list);
  const load = useCountryStore((s) => s.load);
  useEffect(load, [load]);
  return list;
};