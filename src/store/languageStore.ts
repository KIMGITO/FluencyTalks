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
  
  name: (id: string) => string;
  
  nameIn: (id: string, locales?: string | string[]) => string;
  
  labelOf: (
    l: Pick<UserLanguage, 'language_id'> & Partial<UserLanguage>,
    locales?: string | string[],
  ) => string;
  
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
  
  labelOf: (l, locales) => {
    const row = get().list.find((x) => x.id === normalizeCode(l.language_id));
    
    
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


export const useLanguages = (): DisplayLanguage[] => {
  const list = useLanguageStore((s) => s.list);
  const load = useLanguageStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return list;
};




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


export const useCommonLanguages = () => {
  const list = useLanguages();
  const common = list.filter((l) => l.is_supported_learning);
  const rest = list.filter((l) => !l.is_supported_learning);
  
  const swahili = list.find((l) => l.id === "swh");
  const vietnamese = list.find((l) => l.id === "vie");
  
  const priority = [...common];
  const addedIds = new Set(common.map((l) => l.id));
  
  for (const l of rest) {
    if (priority.length >= 40) break;
    if (!addedIds.has(l.id)) {
      priority.push(l);
      addedIds.add(l.id);
    }
  }
  
  if (swahili && !addedIds.has(swahili.id)) {
    if (priority.length < 40) {
      priority.push(swahili);
    } else {
      
      priority[priority.length - 1] = swahili;
    }
  }
  
  if (vietnamese && !addedIds.has(vietnamese.id)) {
    if (priority.length < 40) {
      priority.push(vietnamese);
    } else {

      priority[priority.length - 1] = vietnamese;
    }
  }
  return useMemo(() => priority, [list]);
};


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
