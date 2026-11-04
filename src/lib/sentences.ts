// Splits a long post into sentences for correcting one at a time. No imports, so it can be tested without a browser.

export interface Sentence { start: number; end: number; text: string }

const FALLBACK = /[^.!?。！？\n]+(?:[.!?。！？]+["'”’)\]]*|\n|$)|[.!?。！？\n]+/gu;

/**
 * Positions are counted in characters (code points), as the database counts them. A browser counts an emoji as two,
 * so a position from `.length` would point at the wrong words after one. The server checks the range and reads the
 * words itself, so a bad split can only ever produce an awkward selection, never change the wrong text.
 */
export function splitSentences(text: string, locale?: string): Sentence[] {
  const pieces: string[] = [];
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) {
    for (const s of new Segmenter(locale, { granularity: 'sentence' }).segment(text)) pieces.push(s.segment);
  } else {
    pieces.push(...(text.match(FALLBACK) ?? []));
  }
  const out: Sentence[] = [];
  let at = 0;
  for (const piece of pieces) {
    const chars = Array.from(piece);
    const lead = chars.findIndex((c) => !/\s/u.test(c));
    if (lead >= 0) {
      let tail = chars.length;
      while (tail > lead && /\s/u.test(chars[tail - 1])) tail--;
      out.push({ start: at + lead, end: at + tail, text: chars.slice(lead, tail).join('') });
    }
    at += chars.length;
  }
  return out;
}

/** The words between two positions, counted the same way. */
export const sliceChars = (text: string, start: number, end?: number) => Array.from(text).slice(start, end).join('');
