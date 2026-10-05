/** One row of public.languages. `id` is the ISO 639-3 3-letter code, lowercase. */
export interface Language { id: string; iso_639_1: string | null; english_name: string; native_name: string | null; is_supported_learning: boolean }

/** A language as it reaches a picker: the row, plus the name we decided to print. */
export interface DisplayLanguage extends Language { label: string }

/**
 * The canonical form of a code. Everything that stores, filters or sends a language goes
 * through here, so 'ENG', ' eng ' and 'Eng' can never end up as three different languages.
 * Returns null for anything that is not an ISO 639-3 code.
 */
export const normalizeCode = (code?: string | null): string | null => {
  const c = code?.trim().toLowerCase() ?? '';
  return /^[a-z]{3}$/.test(c) ? c : null;
};

/** Text the browser cannot draw: private-use or unassigned slots render as a box. */
const canRender = (s: string) => {
  for (const ch of s) {
    const p = ch.codePointAt(0)!;
    if (p >= 0xe000 && p <= 0xf8ff) return false;   // private use
    if (p >= 0xfff0 && p <= 0xffff) return false;   // specials
    if (p >= 0x0378 && p <= 0x03ff) return false;   // unassigned Greek
  }
  return s.trim().length > 0;
};

/** BCP-47 tag the browser's Intl API understands, from the row we store. */
const bcp47Of = (l: { id?: string; iso_639_1?: string | null }): string => {
  const two = l.iso_639_1?.trim().toLowerCase();
  if (two && /^[a-z]{2}$/.test(two)) return two;
  // No alpha-2 in the standard: map the well-known macrolanguages / variants.
  const id = l.id?.trim().toLowerCase() ?? '';
  if (id === 'cmn' || id === 'yue') return 'zh';
  if (id === 'nob') return 'nb';
  if (id === 'fil' || id === 'tgl') return 'tl';
  if (id === 'hat') return 'ht';
  if (id === 'baq') return 'eu';
  return id || 'en';
};

const displayCache = new Map<string, string>();

/**
 * A language name in the viewer's language: first their native language(s), then
 * English, then the autonym. Uses the browser's Intl.DisplayNames (no dependency),
 * so a Swahili speaker reads "Kijapani", an English speaker reads "Japanese",
 * and nobody ever sees only "日本語" unless it IS their language.
 */
export const languageIn = (
  l: { id?: string; iso_639_1?: string | null; english_name?: string | null; native_name?: string | null } | null | undefined,
  locales?: string | string[],
): string => {
  if (!l) return '';
  const want = (Array.isArray(locales) ? locales : [locales]).filter(Boolean) as string[];
  const key = `${bcp47Of(l)}|${want.join(',')}`;
  const hit = displayCache.get(key);
  if (hit) return hit;
  let out = '';
  try {
    const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (t: string) => string | undefined } }).DisplayNames;
    if (DN && want.length) {
      // Longest match first: exact native tag beats bare 'en'.
      for (const loc of want) {
        try { out = new DN([loc], { type: 'language' }).of(bcp47Of(l)) ?? ''; } catch { out = ''; }
        if (out) break;
      }
    }
  } catch { out = ''; }
  if (!out) out = l.english_name ?? '';
  if (!out && l.native_name && canRender(l.native_name)) out = l.native_name;
  displayCache.set(key, out);
  return out;
};

/**
 * What the user reads: the autonym first, English only as a fallback. A language whose
 * native name is missing, blank or not renderable in this browser falls back instead of
 * printing an empty chip. Both names are optional so this also works on the `languages` a
 * person's rows already carry, without a lookup.
 */
export const languageLabel = (l?: { native_name?: string | null; english_name?: string | null } | null): string => {
  if (!l) return '';
  if (l.native_name && canRender(l.native_name)) return l.native_name;
  return l.english_name ?? '';
};

/** Native name when it survives rendering, else English: also the order pickers sort in. */
export const sortKey = (l: { native_name?: string | null; english_name?: string | null }): string =>
  (languageLabel(l) || l.english_name || '').normalize('NFD').toLocaleLowerCase();

/**
 * The 2-letter code most translation APIs expect, derived from the ISO 639-3 id we store.
 *
 * The table's own `iso_639_1` covers almost every case and should be preferred (pass it in as
 * `alpha2`). The map below only carries what the table cannot express: codes the standard
 * gives no alpha-2 at all (Mandarin) or several of which share one (Chinese, Cantonese, ...).
 * Returns null when there is no mapping, and the caller falls back to the ISO code itself.
 */
const TRANSLATION_ALPHA2: Record<string, string> = {
  cmn: 'zh', zho: 'zh', yue: 'zh', wuu: 'zh', hak: 'zh', nan: 'zh', hsn: 'zh',
  nob: 'no', nno: 'no', fra: 'fr', frm: 'fr', deu: 'de', spa: 'es', ces: 'cs', slk: 'sk',
  nld: 'nl', ell: 'el', hye: 'hy', kat: 'ka', msa: 'ms', tgl: 'tl', fil: 'tl',
  pus: 'ps', pes: 'fa', mya: 'my', ara: 'ar', swh: 'sw', kur: 'ku', mri: 'mi', mhr: 'mr',
};

/** ISO 639-3 -> the code the translation provider speaks; null when there is no mapping. */
export const translationCode = (iso3: string, alpha2?: string | null): string | null => {
  const id = normalizeCode(iso3);
  if (!id) return null;
  return TRANSLATION_ALPHA2[id] ?? (alpha2 && /^[a-z]{2}$/.test(alpha2) ? alpha2 : null);
};

/** The provider code, or the ISO code itself when we have no alpha-2 to offer. */
export const providerCode = (iso3: string, alpha2?: string | null): string =>
  translationCode(iso3, alpha2) ?? normalizeCode(iso3) ?? iso3;
