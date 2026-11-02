import { useLanguageStore } from '@/store/languageStore';
import type { MatchKind } from '@/types/db';


const label = (kind: MatchKind, lang: string) =>
  kind === 'swap' ? `Swap · ${lang}` : kind === 'native' ? `Speaks ${lang}` : kind === 'learning' ? `Learning ${lang}` : '';

export function MatchBadge({ kind, language }: { kind: MatchKind; language?: string | null }) {
  const nameOf = useLanguageStore((s) => s.name);
  const text = kind === 'other' ? '' : label(kind, nameOf(language ?? ''));
  if (!text) return null;
  return (
    <span className="ft-tag shrink-0 bg-brand-soft">
      {text}
    </span>
  );
}