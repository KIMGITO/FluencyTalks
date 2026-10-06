import { useState } from 'react';
import clsx from 'clsx';
import { Pin, Reply, Trash2, UserX, Languages } from 'lucide-react';
import type { Message } from '@/types/db';

const QUICK = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

interface Props {
  message: Message; 
  mine: boolean; 
  pinned: boolean;
  onClose: () => void;
  onReply: () => void; 
  onPin: () => void;
  onTranslate: () => void; // New translator callback
  onDeleteMe: () => void; 
  onDeleteAll: () => void;
  onReact: (emoji: string) => Promise<void>;
}

export function MessageActions({ 
  message, mine, pinned, onClose, onReply, onPin, onTranslate, onDeleteMe, onDeleteAll, onReact 
}: Props) {
  const [error, setError] = useState('');
  const [reacting, setReacting] = useState(false);

  if (message.deleted_at || message.body === '[deleted]') return null;

  const pick = async (emoji: string) => {
    setReacting(true); 
    setError('');
    try { 
      await onReact(emoji); 
      onClose(); 
    } catch (e) { 
      setError((e as Error).message); 
    } finally { 
      setReacting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Message actions" onClick={onClose}>
      {/* Background Overlay: Dim on mobile, clean click-away on desktop */}
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-xs md:bg-transparent" />

      {/* Main Container */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          // Universal Styles
          'ft-card shadow-pop z-10 w-full overflow-hidden border border-border bg-surface-1 transition-all',
          // Mobile: Bottom sheet layout
          'rounded-t-2xl px-2 pb-6 pt-3 animate-in slide-in-from-bottom duration-150',
          // Desktop/Laptop: Compact floating contextual menu
          'md:max-w-[240px] md:rounded-xl md:p-1.5 md:animate-in md:fade-in md:zoom-in-95'
        )}
      >
        {/* Mobile Pull Drag Indicator Strip */}
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-border md:hidden" />

        {/* Quick Reactions Bar */}
        <div className="flex items-center justify-between gap-1 px-2 py-1 bg-surface-2/50 rounded-xl md:bg-transparent md:p-0" aria-label="Quick reactions">
          {QUICK.map((e) => (
            <button 
              key={e} 
              disabled={reacting} 
              onClick={() => pick(e)} 
              aria-label={`React ${e}`}
              className="rounded-lg p-2 text-xl transition active:scale-95 md:p-1 md:text-lg md:hover:scale-110 md:hover:bg-surface-2 disabled:opacity-50"
            >
              {e}
            </button>
          ))}
        </div>

        {/* Divider line for desktop layout */}
        <div className="hidden my-1 border-t border-border md:block" />

        {/* Menu Actions List */}
        <div className="mt-3 flex flex-col gap-0.5 md:mt-0">
          <button onClick={() => { onReply(); onClose(); }} className="ft-menu-item flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition hover:bg-surface-2 md:py-1.5 md:rounded-lg">
            <Reply size={16} className="text-muted" /> 
            <span>Reply</span>
          </button>

          <button onClick={() => { onTranslate(); onClose(); }} className="ft-menu-item flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition hover:bg-surface-2 md:py-1.5 md:rounded-lg">
            <Languages size={16} className="text-muted" /> 
            <span>Translate message</span>
          </button>

          <button onClick={() => { onPin(); onClose(); }} className="ft-menu-item flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition hover:bg-surface-2 md:py-1.5 md:rounded-lg">
            <Pin size={16} className="text-muted" /> 
            <span>{pinned ? 'Unpin' : 'Pin to top'}</span>
          </button>

          <div className="my-1 border-t border-border" />

          <button onClick={() => { onDeleteMe(); onClose(); }} className="ft-menu-item flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition hover:bg-surface-2 text-muted md:py-1.5 md:rounded-lg">
            <UserX size={16} /> 
            <span>Delete for me</span>
          </button>

          {mine && (
            <button onClick={() => { onDeleteAll(); onClose(); }} className="ft-menu-item flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition hover:bg-danger/10 text-danger md:py-1.5 md:rounded-lg">
              <Trash2 size={16} /> 
              <span>Delete for everyone</span>
            </button>
          )}
        </div>

        {error && <p className="mt-2 px-3 text-xs font-medium text-danger animate-pulse">{error}</p>}
      </div>
    </div>
  );
}
