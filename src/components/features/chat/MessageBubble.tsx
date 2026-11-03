import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Bookmark, BookmarkCheck, Check, CheckCheck, Coins, Languages, MoreVertical, Pencil, Pin, RotateCw } from 'lucide-react';
import { CorrectionCard } from './CorrectionCard';
import { ReactionBar } from './ReactionBar';
import { MessageActions } from './MessageActions';
import { useMessageGestures } from '@/hooks/useMessageGestures';
import { formatTime } from '@/lib/format';
import { translateText } from '@/lib/translate';
import { canCorrect } from '@/lib/corrections';
import { useProfileStore } from '@/store/profileStore';
import type { Correction, Message, Reaction } from '@/types/db';
import { userMessage } from '@/lib/errors';


export type TickState = 'sent' | 'delivered' | 'read';

interface Props {
  message: Message;
  tick?: TickState;
  mine: boolean;
  myId: string;
  corrections: Correction[];
  reactions?: Reaction[]; 
  otherName: string;
  /** The person you chat with: only their corrections can be discussed in the chat. */
  otherId?: string | null;
  pinned: boolean;
  saved: boolean;
  /** No composer on a message request you haven't accepted, so nothing to reply with. */
  canReply: boolean;
  showTail: boolean;
  replyTo?: Message | null;
  translateTo: string; 
  translateApi: string; 
  onCorrect: (m: Message) => void;
  onSave: (m: Message, translation?: string) => void;
  onReact: (m: Message, emoji: string) => Promise<void>;
  onAccept: (c: Correction) => Promise<void>;
  onDecline: (c: Correction, reason: string) => Promise<void>;
  onReply: (m: Message) => void;
  onPin: (m: Message) => void;
  onDeleteMe: (m: Message) => void;
  onDeleteAll: (m: Message) => void;
  onTranslated?: (
    m: Message,
    translated: string,
    targetLang: string,
  ) => unknown; 
}
type Translation = { state: 'loading' | 'done' | 'error'; text: string };
const ERROR_VISIBLE_MS = 5000;

/** A small, labelled icon button under a message. The label is the tooltip and what screen readers say. */
function ActionIcon({ label, pressed, disabled, onClick, children }: { label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}
      className={clsx('rounded-full p-1.5 transition hover:bg-surface-2 hover:text-ink active:scale-90 disabled:cursor-default', pressed && 'text-ink')}>
      {children}
    </button>
  );
}
export function MessageBubble({
  message,
  tick,
  mine,
  myId,
  corrections,
  reactions,
  otherName,
  otherId,
  pinned,
  saved,
  canReply,
  showTail,
  replyTo,
  translateTo,
  translateApi,
  onCorrect,
  onSave,
  onReact,
  onAccept,
  onDecline,
  onReply,
  onPin,
  onDeleteMe,
  onDeleteAll,
  onTranslated,
}: Props) {
  const me = useProfileStore((s) => s.me);
  const [tr, setTr] = useState<Translation | null>(null);
  const [sheet, setSheet] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  useMessageGestures(rowRef, {
    onSwipeRight: () => {
      if (!message.deleted_at && canReply) onReply(message);
    },
    onLongPress: () => setSheet(true),
  });
  useEffect(() => {
    if (tr?.state !== 'error') return;
    const t = setTimeout(() => setTr(null), ERROR_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [tr]);
  const translate = async (retry = false) => {
    if (tr?.state === 'done' && !retry) return setTr(null);
    setTr({ state: 'loading', text: '' });
    try {
      const out = await translateText(message.body, translateTo, translateApi);
      setTr({ state: 'done', text: out });
      
      
      if (out.trim().toLowerCase() !== message.body.trim().toLowerCase())
        onTranslated?.(message, out, translateTo);
    } catch (e) {
      setTr({ state: 'error', text: userMessage(e) });
    }
  };
  const alreadyMine =
    tr?.state === 'done' &&
    tr.text.trim().toLowerCase() === message.body.trim().toLowerCase();
  const gone = !!message.deleted_at || message.body === '[deleted]';
  if (gone) return null;
  // Only what this person can actually do: the server refuses a correction from anyone else.
  const mayCorrect = !mine && canCorrect(me, message.language_id);
  const mayTranslate = message.language_id !== translateTo;
  return (
    <div
      className={clsx(
        'group flex flex-col gap-0.5',
        mine ? 'items-end' : 'items-start',
        showTail ? 'ft-cluster-gap' : 'ft-row-gap',
      )}
    >
      <div
        ref={rowRef}
        className="ft-swipe-row relative flex w-full flex-col"
        style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}
      >
        <div
          className={clsx(
            'ft-bubble',
            mine ? 'ft-bubble-out' : 'ft-bubble-in',
            showTail && 'ft-tail',
          )}
        >
          {pinned && (
            <p className="mb-0.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide opacity-70">
              <Pin size={10} /> Pinned
            </p>
          )}
          {replyTo && !replyTo.deleted_at && replyTo.body !== '[deleted]' && (
            <div
              className={clsx(
                'mb-1 max-w-full truncate rounded border-l-2 px-1.5 py-0.5 text-xs opacity-90',
                mine
                  ? 'border-on-brand/60 bg-ink/10'
                  : 'border-brand bg-brand-soft',
              )}
            >
              <span className="font-semibold">
                {replyTo.sender_id === myId ? 'You' : otherName}:{' '}
              </span>
              {replyTo.body.slice(0, 90)}
            </div>
          )}
          <p
            className={clsx(
              'ft-selectable whitespace-pre-wrap break-words text-[0.9rem] leading-[1.32]',
            )}
          >
            {message.body}
          </p>
          <p className="ft-bubble-meta">
            {formatTime(message.created_at)}
            {message.edited_at && ' · edited'}
            {message.is_bounty && (
              <span className="ml-1 inline-flex items-center gap-0.5 align-middle font-semibold" title={`Bounty: ${message.bounty_cost ?? 50} points`}>
                · <Coins size={11} aria-hidden /> {message.bounty_status === 'open' ? 'Bounty open' : message.bounty_status === 'paid' ? 'Bounty paid' : 'Bounty refunded'}
              </span>)}
            {mine && tick && (
              <span
                className={clsx('ml-1 inline-flex align-middle', tick === 'read' ? 'opacity-100' : 'opacity-60')}
                aria-label={tick}
                title={tick}
              >
                {tick === 'sent' ? <Check size={12} aria-hidden /> : <CheckCheck size={12} aria-hidden />}
              </span>
            )}
          </p>
          <button
            aria-label="Message options"
            onClick={() => setSheet(true)}
            className={clsx(
              'absolute top-1 hidden p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 md:block',
              mine
                ? '-left-7 text-muted hover:text-brand'
                : '-right-7 text-muted hover:text-brand',
            )}
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>
      {tr && tr.state !== 'error' && (
        <div className="max-w-[82%] rounded-md bg-surface px-2.5 py-1 text-sm shadow-card" aria-live="polite">
          {tr.state === 'loading' ? <p className="text-xs text-muted">Translating…</p>
            : alreadyMine ? <p className="text-xs text-muted">Already in your language.</p>
            : (<>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted"><Languages size={11} aria-hidden /> Translation</p>
              <p className="ft-selectable whitespace-pre-wrap break-words text-ink">{tr.text}</p>
            </>)}
        </div>
      )}
      {/* A failure says why for a few seconds, then goes away; the message itself is untouched. */}
      {tr?.state === 'error' && (
        <p role="status" className="flex max-w-[82%] items-center gap-1.5 px-1.5 text-xs text-muted">
          <span><span className="font-semibold text-ink">Not translated.</span> {tr.text}</span>
          <button type="button" onClick={() => void translate(true)} className="inline-flex items-center gap-0.5 font-semibold text-ink underline-offset-2 hover:underline">
            <RotateCw size={12} aria-hidden /> Retry
          </button>
        </p>
      )}
      <div className={clsx('flex items-center gap-0.5 px-0.5 text-muted', mine ? 'flex-row-reverse' : 'flex-row')}>
        {mayCorrect && (
          <ActionIcon label="Suggest a correction" onClick={() => onCorrect(message)}><Pencil size={14} aria-hidden /></ActionIcon>
        )}
        {!mine && mayTranslate && (
          <ActionIcon label={tr?.state === 'done' ? 'Hide translation' : 'Translate'} pressed={tr?.state === 'done'} disabled={tr?.state === 'loading'} onClick={() => void translate()}>
            <Languages size={14} aria-hidden />
          </ActionIcon>
        )}
        <ActionIcon label={saved ? 'Remove from phrasebook' : 'Save to phrasebook'} pressed={saved}
          onClick={() => onSave(message, tr?.state === 'done' && !alreadyMine ? tr.text : undefined)}>
          {saved ? <BookmarkCheck size={14} aria-hidden className="text-success" /> : <Bookmark size={14} aria-hidden />}
        </ActionIcon>
      </div>
      {!!reactions?.length && <ReactionBar reactions={reactions} myId={myId} chipsOnly onToggle={(emoji) => onReact(message, emoji)} />}
      {corrections.map((c) => (
        <CorrectionCard
          key={c.id}
          correction={c}
          original={message.body}
          isOwner={mine}
          myId={myId}
          bounty={message.is_bounty}
          onAccept={onAccept}
          onDecline={onDecline}
          onDiscuss={mine && c.corrector_id === otherId ? () => onReply(message) : undefined}
        />
      ))}
      {sheet && (
        <MessageActions
          message={message}
          mine={mine}
          pinned={pinned}
          canReply={canReply}
          canTranslate={mayTranslate}
          onClose={() => setSheet(false)}
          onReply={() => onReply(message)}
          onPin={() => onPin(message)}
          onTranslate={() => void translate()}
          onDeleteMe={() => onDeleteMe(message)}
          onDeleteAll={() => onDeleteAll(message)}
          onReact={(emoji: string) => onReact(message, emoji)}
        />
      )}
    </div>
  );
}
