import { useState } from 'react';
import clsx from 'clsx';
import { SmilePlus } from 'lucide-react';
import { REACTION_EMOJI } from '@/lib/constants';
import type { Reaction } from '@/types/db';

/** Grouped emoji chips (tap to add or remove mine) plus a small picker. */
export function ReactionBar({ reactions, myId, onToggle }: { reactions: Reaction[]; myId: string; onToggle: (emoji: string) => Promise<void> }) {
  const [picking, setPicking] = useState(false); const [error, setError] = useState('');
  const groups = new Map<string, { count: number; mine: boolean }>();
  reactions.forEach((r) => { const g = groups.get(r.emoji) ?? { count: 0, mine: false }; groups.set(r.emoji, { count: g.count + 1, mine: g.mine || r.user_id === myId }); });
  const toggle = async (emoji: string) => { setPicking(false); setError(''); try { await onToggle(emoji); } catch (e) { setError((e as Error).message); } };
  return (
    <div className="flex flex-wrap items-center gap-1 px-2">
      {[...groups].map(([emoji, g]) => (
        <button key={emoji} aria-label={`${emoji} ${g.count}${g.mine ? ', you reacted' : ''}`} aria-pressed={g.mine} onClick={() => toggle(emoji)}
          className={clsx('rounded-full border px-2 py-1 text-xs', g.mine ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-muted hover:bg-surface-2')}>{emoji} {g.count}</button>))}
      <button aria-label="Add reaction" aria-expanded={picking} onClick={() => setPicking(!picking)} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-brand"><SmilePlus size={16} /></button>
      {picking && REACTION_EMOJI.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => toggle(e)} className="rounded-full p-1 text-base hover:bg-surface-2">{e}</button>)}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
