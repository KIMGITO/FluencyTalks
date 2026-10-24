
export interface Language { id: string; iso_639_1: string | null; english_name: string; native_name: string | null; is_supported_learning: boolean }


export interface DisplayLanguage extends Language { label: string }


export const normalizeCode = (code?: string | null): string | null => {
  const c = code?.trim().toLowerCase() ?? '';
  return /^[a-z]{3}$/.test(c) ? c : null;
};


const canRender = (s: string) => {
  for (const ch of s) {
    const p = ch.codePointAt(0)!;
    if (p >= 0xe000 && p <= 0xf8ff) return false;   
    if (p >= 0xfff0 && p <= 0xffff) return false;   
    if (p >= 0x0378 && p <= 0x03ff) return false;   
  }
  return s.trim().length > 0;
};


const bcp47Of = (l: { id?: string | null; language_id?: string | null; iso_639_1?: string | null }): string => {
  const two = l.iso_639_1?.trim().toLowerCase();
  if (two && /^[a-z]{2}$/.test(two)) return two;
  
  const id = (l.id ?? l.language_id ?? '').trim().toLowerCase();
  if (id === 'cmn' || id === 'yue') return 'zh';
  if (id === 'nob') return 'nb';
  if (id === 'fil' || id === 'tgl') return 'tl';
  if (id === 'hat') return 'ht';
  if (id === 'baq') return 'eu';
  return /^[a-z]{3}$/.test(id) ? id : '';
};

const displayCache = new Map<string, string>();


export const languageIn = (
  l: { id?: string | null; language_id?: string | null; iso_639_1?: string | null; english_name?: string | null; native_name?: string | null } | null | undefined,
  locales?: string | string[],
): string => {
  if (!l) return '';
  const tag = bcp47Of(l);
  if (!tag) return l.english_name ?? '';
  const want = (Array.isArray(locales) ? locales : [locales]).filter(Boolean) as string[];
  const key = `${tag}|${want.join(',')}`;
  const hit = displayCache.get(key);
  if (hit) return hit;
  let out = '';
  try {
    const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (t: string) => string | undefined } }).DisplayNames;
    if (DN && want.length) {
      
      for (const loc of want) {
        try { out = new DN([loc], { type: 'language' }).of(tag) ?? ''; } catch { out = ''; }
        if (out) break;
      }
    }
  } catch { out = ''; }
  if (!out) out = l.english_name ?? '';
  if (!out && l.native_name && canRender(l.native_name)) out = l.native_name;
  displayCache.set(key, out);
  return out;
};


export const languageLabel = (l?: { native_name?: string | null; english_name?: string | null } | null): string => {
  if (!l) return '';
  if (l.native_name && canRender(l.native_name)) return l.native_name;
  return l.english_name ?? '';
};


export const sortKey = (l: { native_name?: string | null; english_name?: string | null }): string =>
  (languageLabel(l) || l.english_name || '').normalize('NFD').toLocaleLowerCase();


const TRANSLATION_ALPHA2: Record<string, string> = {
  cmn: 'zh', zho: 'zh', yue: 'zh', wuu: 'zh', hak: 'zh', nan: 'zh', hsn: 'zh',
  nob: 'no', nno: 'no', fra: 'fr', frm: 'fr', deu: 'de', spa: 'es', ces: 'cs', slk: 'sk',
  nld: 'nl', ell: 'el', hye: 'hy', kat: 'ka', msa: 'ms', tgl: 'tl', fil: 'tl',
  pus: 'ps', pes: 'fa', mya: 'my', ara: 'ar', swh: 'sw', kur: 'ku', mri: 'mi', mhr: 'mr',
};


export const translationCode = (iso3: string, alpha2?: string | null): string | null => {
  const id = normalizeCode(iso3);
  if (!id) return null;
  return TRANSLATION_ALPHA2[id] ?? (alpha2 && /^[a-z]{2}$/.test(alpha2) ? alpha2 : null);
};


export const providerCode = (iso3: string, alpha2?: string | null): string =>
  translationCode(iso3, alpha2) ?? normalizeCode(iso3) ?? iso3;
