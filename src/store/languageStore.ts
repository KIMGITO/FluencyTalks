import { useEffect } from 'react';
import { create } from 'zustand';
import { listLanguages } from '@/services';
import { languageLabel, normalizeCode, providerCode } from '@/lib/languages';
import type { DisplayLanguage, UserLanguage } from '@/types/db';

interface S {
  list: DisplayLanguage[];
  load: () => Promise<void>;
  /** The name to print for an ISO 639-3 id: the autonym, or the English name as a fallback. */
  name: (id: string) => string;
  /** The native name of one of my languages; '' when it is unknown to the table. */
  labelOf: (l: Pick<UserLanguage, 'language_id'> & Partial<UserLanguage>) => string;
  /** The code a translation provider speaks for an id, using the table's own iso_639_1. */
  provider: (id: string) => string;
}

export const useLanguageStore = create<S>((set, get) => ({
  list: [],
  load: async () => { if (!get().list.length) set({ list: await listLanguages() }); },
  name: (id) => languageLabel(get().list.find((l) => l.id === normalizeCode(id))) || normalizeCode(id) || id,
  labelOf: (l) => languageLabel(l) || get().name(l.language_id),
  provider: (id) => providerCode(id, get().list.find((l) => l.id === normalizeCode(id))?.iso_639_1),
}));

/**
 * The pickable languages, fetched once per session and shared. Every view that renders a
 * language name calls this, so it subscribes and re-renders when the rows arrive. A person
 * card can also print the name the server already joined onto their row, so this is only
 * needed where the user picks a language rather than reads one.
 */
export const useLanguages = (): DisplayLanguage[] => {
  const list = useLanguageStore((s) => s.list);
  const load = useLanguageStore((s) => s.load);
  useEffect(() => { void load(); }, [load]);
  return list;
};
