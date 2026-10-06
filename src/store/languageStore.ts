import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { listLanguages } from '@/services';
import {
  languageIn,
  languageLabel,
  normalizeCode,
  providerCode,
} from '@/lib/languages';
import { useProfileStore } from '@/store/profileStore';
import type { DisplayLanguage, UserLanguage } from '@/types/db';

interface S {
  list: DisplayLanguage[];
  load: () => Promise<void>;
  /** The name to print for an ISO 639-3 id: the autonym, or the English name as a fallback. */
  name: (id: string) => string;
  /** The name in the viewer's language: their native language(s) first, then English, then autonym. */
  nameIn: (id: string, locales?: string | string[]) => string;
  /** The native name of one of my languages; '' when it is unknown to the table. */
  labelOf: (
    l: Pick<UserLanguage, 'language_id'> & Partial<UserLanguage>,
    locales?: string | string[],
  ) => string;
  /** The code a translation provider speaks for an id, using the table's own iso_639_1. */
  provider: (id: string) => string;
}

export const useLanguageStore = create<S>((set, get) => ({
  list: [],
  load: async () => {
    if (!get().list.length) set({ list: await listLanguages() });
  },
  name: (id) =>
    languageLabel(get().list.find((l) => l.id === normalizeCode(id))) ||
    normalizeCode(id) ||
    id,
  nameIn: (id, locales) => {
    const row = get().list.find((l) => l.id === normalizeCode(id));
    return languageIn(row, locales) || get().name(id);
  },
  /** The native name of one of my languages: the autonym first (Español, not
   *  Spanish), viewer-language name second, id last. Native languages must read
   *  in their own correct name, so the autonym wins over Intl.DisplayNames. */
  labelOf: (l, locales) => {
    const row = get().list.find((x) => x.id === normalizeCode(l.language_id));
    // l may carry null names (e.g. a fresh picker value); never let those wipe
    // the looked-up row — prefer whichever side actually has a name.
    const merged = {
      ...l, ...row,
      id: row?.id ?? l.language_id,
      native_name: l.native_name ?? row?.native_name ?? null,
      english_name: l.english_name ?? row?.english_name ?? null,
    } as DisplayLanguage;
    return (
      languageLabel(merged) ||
      languageIn(merged, locales) ||
      get().name(l.language_id)
    );
  },
  provider: (id) =>
    providerCode(
      id,
      get().list.find((l) => l.id === normalizeCode(id))?.iso_639_1,
    ),
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
  useEffect(() => {
    void load();
  }, [load]);
  return list;
};

/**
 * BCP-47 tags of my native languages (most specific first), for Intl.DisplayNames.
 * Falls back to the browser locale, then English — so names always read in something I know.
 */

/** Resolve display locales from my native languages + browser + English. Pure helper. */
export const localesFor = (
  nativeIds: string[],
  list: DisplayLanguage[],
): string[] => {
  const tags: string[] = [];
  for (const id of nativeIds) {
    const row = list.find((l) => l.id === normalizeCode(id));
    const two = row?.iso_639_1?.toLowerCase();
    if (two && /^[a-z]{2}$/.test(two) && !tags.includes(two)) tags.push(two);
  }
  const nav = (navigator.language ?? '').toLowerCase().split('-')[0];
  if (nav && !tags.includes(nav)) tags.push(nav);
  if (!tags.includes('en')) tags.push('en');
  return tags;
};

/** Display label for a row in my language: "Japanese (日本語)" — autonym only when it differs. */
export const displayLabel = (
  l: DisplayLanguage,
  locales: string | string[],
): string => {
  const main = languageIn(l, locales) || l.english_name;
  const auto = l.native_name?.trim();
  if (auto && auto.toLowerCase() !== main.toLowerCase())
    return `${main} (${auto})`;
  return main;
};

/** Common-100 first, everything else behind the expander. */
export const usePriorityLanguages = () => {
  const list = useLanguages();
  return useMemo(
    () => ({
      common: list.filter((l) => l.is_supported_learning),
      rest: list.filter((l) => !l.is_supported_learning),
    }),
    [list],
  );
};

/**
 * Locales for display: my native languages (BCP-47) + browser + English.
 * Reads profileStore directly so every chip/caller gets it with one hook.
 */
export const useDisplayLocales = (): string[] => {
  const list = useLanguageStore((s) => s.list);
  const nativeIds = useProfileStore((s) =>
    s.languages.filter((l) => l.role === 'native').map((l) => l.language_id),
  );
  const load = useLanguageStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return useMemo(() => localesFor(nativeIds, list), [nativeIds, list]);
};
