import { useEffect } from 'react';
import { create } from 'zustand';
import { listCountries } from '@/services';
import type { Country } from '@/types/db';

interface S { list: Country[]; load: () => void }
let inflight: Promise<void> | null = null;   // many badges mount at once; only one request goes out

/** The country list is static reference data, so it is fetched once per session and shared. */
export const useCountryStore = create<S>((set, get) => ({
  list: [],
  load: () => {
    if (get().list.length || inflight) return;
    inflight = listCountries().then((list) => { if (list.length) set({ list }); }).finally(() => { inflight = null; });
  },
}));

/**
 * The country list, fetching it on first mount. Every view that shows a flag calls this,
 * so it subscribes to the store and re-renders once the names arrive.
 */
export const useCountries = (): Country[] => {
  const list = useCountryStore((s) => s.list);
  const load = useCountryStore((s) => s.load);
  useEffect(load, [load]);
  return list;
};