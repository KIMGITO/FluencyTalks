import { useState } from 'react';
import clsx from 'clsx';
import { Pin, Reply, Trash2, UserX } from 'lucide-react';
import type { Message } from '@/types/db';

const QUICK = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

interface Props {
  message: Message; mine: boolean; pinned: boolean;
  onClose: () => void;
  onReply: () => void; onPin: () => void;
  onDeleteMe: () => void; onDeleteAll: () => void;
  onReact: (emoji: string) => Promise<void>;
}

/**
 * "More panel": bottom action sheet on touch (long-press), centered popover on
 * desktop (3-dots hover button). Same actions everywhere.
 */
export function MessageActions({ message, mine, pinned, onClose, onReply, onPin, onDeleteMe, onDeleteAll, onReact }: Props) {
  const [error, setError] = useState('');
  const [reacting, setReacting] = useState(false);
  if (message.deleted_at || message.body === '[deleted]') return null;
  const pick = async (emoji: string) => {
    setReacting(true); setError('');
    try { await onReact(emoji); onClose(); } catch (e) { setError((e as Error).message); } finally { setReacting(false); }
  };
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Message actions" onClick={onClose}>
      {/* desktop: dim nothing, center a compact popover */}
      <div className="absolute inset-0 bg-ink/40 md:bg-transparent" />
      <div onClick={(e) => e.stopPropagation()}
        className={clsx('ft-sheet absolute inset-x-3 bottom-3 ft-card p-2 shadow-pop',
          'md:inset-auto md:left-1/2 md:top-1/2 md:w-72 md:-translate-x-1/2 md:-translate-y-1/2 md:p-3')}>
        <div className="flex items-center justify-between gap-1 px-1 py-1" aria-label="Quick reactions">
            {QUICK.map((e) => (
              <button key={e} disabled={reacting} onClick={() => pick(e)} aria-label={`React ${e}`}
                className="rounded-full p-1.5 text-xl transition hover:scale-110 hover:bg-surface-2 disabled:opacity-50">{e}</button>))}
            {/* Full emoji search lives inline under each bubble (ReactionBar picker). */}
            <span className="px-1 text-2xs text-muted">1 per message</span>
          </div>
        <div className="mt-1 divide-y divide-border">
          <button onClick={() => { onReply(); onClose(); }} className="ft-menu-item gap-3"><Reply size={17} className="text-muted" /> Reply</button>
          <button onClick={() => { onPin(); onClose(); }} className="ft-menu-item gap-3">
            <Pin size={17} className="text-muted" /> {pinned ? 'Unpin' : 'Pin to top'}
          </button>
          <button onClick={() => { onDeleteMe(); onClose(); }} className="ft-menu-item gap-3"><UserX size={17} className="text-muted" /> Delete for me</button>
          {mine && (
            <button onClick={() => { onDeleteAll(); onClose(); }} className="ft-menu-item gap-3 text-danger"><Trash2 size={17} /> Delete for everyone</button>)}
          
        </div>
        {error && <p className="px-3 pb-1 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
