import { lazy, Suspense, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { Theme } from 'emoji-picker-react';   // type-only: a value import would pull the whole picker into the main chunk
import { SmilePlus } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import type { Reaction } from '@/types/db';

// The picker ships every emoji (~340 kB), so it is only downloaded when a reaction is picked.
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const PICKER_W = 352, PICKER_H = 400;   // keep in sync with width/height props below

/** Grouped emoji chips (tap to add or remove mine) plus the full emoji-picker-react picker. */
export function ReactionBar({ reactions, myId, onToggle }: { reactions: Reaction[]; myId: string; onToggle: (emoji: string) => Promise<void> }) {
  const [picking, setPicking] = useState(false); const [error, setError] = useState('');
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const mode = useThemeStore((s) => s.mode);
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const pickerTheme = (dark ? 'dark' : 'light') as Theme;

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [picking]);

  const groups = new Map<string, { count: number; mine: boolean }>();
  reactions.forEach((r) => { const g = groups.get(r.emoji) ?? { count: 0, mine: false }; groups.set(r.emoji, { count: g.count + 1, mine: g.mine || r.user_id === myId }); });
  const toggle = async (emoji: string) => { setPicking(false); setError(''); try { await onToggle(emoji); } catch (e) { setError((e as Error).message); } };
  // Anchor to the button: above if it fits, otherwise below; clamped to the viewport.
  const openPicker = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const w = Math.min(PICKER_W, window.innerWidth - 24);
    setPos({
      left: Math.min(Math.max(12, r.left), window.innerWidth - w - 12),
      top: r.top - PICKER_H - 8 > 8 ? r.top - PICKER_H - 8 : Math.min(r.bottom + 8, Math.max(8, window.innerHeight - PICKER_H - 8)),
    });
    setPicking(!picking);
  };
  return (
    <div className="flex flex-wrap items-center gap-1 px-2">
      {[...groups].map(([emoji, g]) => (
        <button key={emoji} aria-label={`${emoji} ${g.count}${g.mine ? ', you reacted' : ''}`} aria-pressed={g.mine} onClick={() => toggle(emoji)}
          className={clsx('rounded-full border px-2 py-1 text-xs', g.mine ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-muted hover:bg-surface-2')}>{emoji} {g.count}</button>))}
      <button aria-label="Add reaction" aria-expanded={picking} onClick={openPicker} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-brand"><SmilePlus size={16} /></button>
      {picking && <>
        <div className="fixed inset-0 z-30" onClick={() => setPicking(false)} />
        <div className="fixed z-40 shadow-pop" style={{ left: pos.left, top: pos.top }} role="dialog" aria-label="Pick an emoji">
          <Suspense fallback={<div style={{ width: Math.min(PICKER_W, window.innerWidth - 24), height: PICKER_H }} />}>
            <EmojiPicker theme={pickerTheme} width={Math.min(PICKER_W, window.innerWidth - 24)} height={PICKER_H}
              onEmojiClick={(e) => { void toggle(e.emoji); }} />
          </Suspense>
        </div></>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
