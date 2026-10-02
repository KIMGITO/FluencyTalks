/**
 * Tap-to-translate. The ONLY file that talks to a translation provider, so it can be swapped
 * (DeepL, your own backend) without touching UI code.
 * Provider today: MyMemory (free, no key). The text of a message is sent to it ONLY when the user taps "Translate".
 */
const ENDPOINT = 'https://api.mymemory.translated.net/get';
const CONTACT_EMAIL = import.meta.env.VITE_TRANSLATE_EMAIL as string | undefined;   // optional: raises MyMemory's free daily quota
const MAX_BYTES = 450;      // MyMemory rejects queries over 500 bytes
const MAX_CHUNKS = 12;     // a maximum-length (4000 character) message in an accented Latin script needs about 11
const cache = new Map<string, string>();

export class TranslateError extends Error {}
const bytes = (s: string) => new TextEncoder().encode(s).length;
const apiCode = (code: string) => (code === 'zh' ? 'zh-CN' : code);   // our language codes are ISO 639-1
const decode = (s: string) => new DOMParser().parseFromString(s, 'text/html').documentElement.textContent ?? s;   // the API returns HTML entities

function split(part: string): string[] {
  if (bytes(part) <= MAX_BYTES) return [part];
  const out: string[] = []; let cur = '';
  for (const ch of Array.from(part)) { if (bytes(cur + ch) > MAX_BYTES) { out.push(cur); cur = ''; } cur += ch; }
  return cur ? [...out, cur] : out;
}
/** Sentence-aware chunks that each fit the provider's size limit. */
function chunk(text: string): string[] {
  const out: string[] = []; let cur = '';
  for (const part of (text.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) ?? [text]).flatMap(split)) {
    if (cur && bytes(cur + part) > MAX_BYTES) { out.push(cur); cur = ''; }
    cur += part;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Source language is auto-detected; `target` is one of our language codes (en, es, zh ...). */
export async function translateText(text: string, target: string): Promise<string> {
  const key = `${target}:${text}`; const hit = cache.get(key); if (hit) return hit;
  const chunks = chunk(text.trim());
  if (chunks.length > MAX_CHUNKS) throw new TranslateError('This message is too long to translate.');
  const out: string[] = [];
  for (const q of chunks) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('q', q); url.searchParams.set('langpair', `Autodetect|${apiCode(target)}`);
    if (CONTACT_EMAIL) url.searchParams.set('de', CONTACT_EMAIL);
    let res: Response;
    try { res = await fetch(url); } catch { throw new TranslateError("Couldn't reach the translation service."); }
    const data = await res.json().catch(() => null);
    const status = Number(data?.responseStatus);
    if (!res.ok || status !== 200) throw new TranslateError(status === 429 ? 'Translation limit reached for today. Try again later.' : "Couldn't translate this message.");
    out.push(decode(String(data.responseData?.translatedText ?? '')));
  }
  const result = out.join(' ').trim();
  cache.set(key, result);
  return result;
}
