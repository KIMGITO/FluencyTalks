import clsx from 'clsx';
import { useMemo } from 'react';
import { sliceChars, splitSentences, type Sentence } from '@/lib/sentences';
import type { ThreadItem } from '@/services/review';

/**
 * A story or lesson read sentence by sentence. Someone who can correct taps a sentence to fix just that one.
 * A sentence that already has fixes is underlined, and tapping it for anyone else jumps to them.
 */
export function LongBody({ body, items, canFix, selected, onPick, locale }: {
  body: string; items: ThreadItem[]; canFix: boolean; selected: Sentence | null; onPick: (s: Sentence) => void; locale?: string;
}) {
  const sentences = useMemo(() => splitSentences(body, locale), [body, locale]);
  const fixes = (s: Sentence) => items.filter((i) => i.target_start !== null && i.target_end !== null && i.target_start < s.end && i.target_end > s.start && i.status !== 'withdrawn');
  const parts: React.ReactNode[] = [];
  let at = 0;
  sentences.forEach((s) => {
    if (s.start > at) parts.push(sliceChars(body, at, s.start));
    const onThis = fixes(s);
    const tappable = canFix || onThis.length > 0;
    const look = clsx('rounded-sm', onThis.length > 0 && 'underline decoration-accent decoration-2 underline-offset-4', selected?.start === s.start && 'bg-brand-soft');
    parts.push(tappable
      ? (
        <button
          key={s.start} type="button"
          aria-label={`${canFix ? 'Fix this sentence' : 'See the fixes'}: ${s.text}${onThis.length ? `, ${onThis.length} so far` : ''}`}
          onClick={() => (canFix ? onPick(s) : document.getElementById(`item-${onThis[0].id}`)?.scrollIntoView({ block: 'center', behavior: 'instant' }))}
          className={clsx(look, 'inline text-left transition hover:bg-brand-soft')}
        >{s.text}{onThis.length > 0 && <sup className="ml-0.5 text-2xs font-bold text-muted">{onThis.length}</sup>}</button>
      )
      : <span key={s.start} className={look}>{s.text}</span>);
    at = s.end;
  });
  const total = Array.from(body).length;
  if (at < total) parts.push(sliceChars(body, at));
  return <div className="whitespace-pre-line break-words font-display text-lg leading-8 text-ink">{parts}</div>;
}
