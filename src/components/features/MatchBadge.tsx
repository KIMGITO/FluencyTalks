import { useLanguageStore } from '@/store/languageStore';
import type { MatchKind } from '@/types/db';

/** Says why this person is in the feed, so a match is not just another row. */
const label = (kind: MatchKind, lang: string) =>
  kind === 'native' ? `Teaches ${lang}` : kind === 'learning' ? `Learning ${lang}` : '';

export function MatchBadge({ kind, language }: { kind: MatchKind; language?: string | null }) {
  const nameOf = useLanguageStore((s) => s.name);
  const text = kind === 'other' ? '' : label(kind, nameOf(language ?? ''));
  if (!text) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-semibold text-brand">
      {text}
    </span>
  );
}