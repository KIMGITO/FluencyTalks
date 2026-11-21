import clsx from 'clsx';
import { Pin, Reply, Trash2, UserX, Languages } from 'lucide-react';
import type { Message } from '@/types/db';
import { MenuItem } from '@/components/ui';

const QUICK = ['❤️', '😂', '😮', '😢', '👍'];

interface Props {
  message: Message; 
  mine: boolean; 
  pinned: boolean;
  canReply: boolean;
  canTranslate: boolean;
  onClose: () => void;
  onReply: () => void; 
  onPin: () => void;
  onTranslate: () => void;
  onDeleteMe: () => void; 
  onDeleteAll: () => void;
  onReact: (emoji: string) => unknown;
}

export function MessageActions({
  message, mine, pinned, canReply, canTranslate, onClose, onReply, onPin, onTranslate, onDeleteMe, onDeleteAll, onReact
}: Props) {
  if (message.deleted_at || message.body === '[deleted]') return null;

  // The reaction shows at once; the store reports a failure and takes it back.
  const pick = (emoji: string) => {
    void onReact(emoji);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Message actions" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-xs md:bg-transparent" />

      <div 
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          
          'ft-card shadow-pop z-10 w-full overflow-hidden border border-border bg-surface-1 transition-all',
          
          'rounded-t-2xl px-2 pb-6 pt-3 animate-in slide-in-from-bottom duration-150',
          
          'md:max-w-[240px] md:rounded-md md:p-1.5 md:animate-in md:fade-in md:zoom-in-95'
        )}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-border md:hidden" />

        <div className="flex items-center justify-between gap-1 px-2 py-1 bg-surface-2/50 rounded-md md:bg-transparent md:p-0" aria-label="Quick reactions">
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => pick(e)}
              aria-label={`React ${e}`}
              className="rounded-lg p-2 text-xl transition active:scale-95 md:p-1 md:text-lg md:hover:scale-110 md:hover:bg-surface-2"
            >
              {e}
            </button>
          ))}
        </div>

        <div className="hidden my-1 border-t border-border md:block" />

        <div className="mt-3 flex flex-col gap-0.5 md:mt-0">
          {canReply && (
            <MenuItem onClick={() => { onReply(); onClose(); }} className="gap-3 py-2.5 md:py-1.5">
              <Reply size={16} className="text-muted" /> 
              <span>Reply</span>
            </MenuItem>
          )}

          {canTranslate && (
            <MenuItem onClick={() => { onTranslate(); onClose(); }} className="gap-3 py-2.5 md:py-1.5">
              <Languages size={16} className="text-muted" /> 
              <span>Translate message</span>
            </MenuItem>
          )}

          <MenuItem onClick={() => { onPin(); onClose(); }} className="gap-3 py-2.5 md:py-1.5">
            <Pin size={16} className="text-muted" /> 
            <span>{pinned ? 'Unpin' : 'Pin to top'}</span>
          </MenuItem>

          <div className="my-1 border-t border-border" />

          <MenuItem onClick={() => { onDeleteMe(); onClose(); }} quiet className="gap-3 py-2.5 md:py-1.5">
            <UserX size={16} /> 
            <span>Delete for me</span>
          </MenuItem>

          {mine && (
            <MenuItem onClick={() => { onDeleteAll(); onClose(); }} danger className="gap-3 py-2.5 md:py-1.5">
              <Trash2 size={16} /> 
              <span>Delete for everyone</span>
            </MenuItem>
          )}
        </div>
      </div>
    </div>
  );
}
