import { useRef, useState } from 'react';
import clsx from 'clsx';
import { MoreVertical, Pin } from 'lucide-react';
import { CorrectionCard } from './CorrectionCard';
import { ReactionBar } from './ReactionBar';
import { useMessageGestures } from '@/hooks/useMessageGestures';
import { formatTime } from '@/lib/format';
import { translateText } from '@/lib/translate';
import type { Correction, Message, Reaction } from '@/types/db';

interface Props {
  message: Message;
  mine: boolean;
  myId: string;
  corrections: Correction[];
  reactions: Reaction[];
  otherName: string;
  pinned: boolean;
  showTail: boolean;
  replyTo?: Message | null;
  translateTo: string; // ISO 639-3 id of the language the viewer wants translations in (their native one)
  translateApi: string; // the same language as the translation API names it (usually its iso_639_1)
  onCorrect: (m: Message) => void;
  onSave: (m: Message, translation?: string) => Promise<unknown>;
  onReact: (m: Message, emoji: string) => Promise<void>;
  onAccept: (c: Correction) => Promise<void>;
  onDismiss: (c: Correction) => Promise<void>;
  onReply: (m: Message) => void;
  onPin: (m: Message) => void;
  onDeleteMe: (m: Message) => void;
  onDeleteAll: (m: Message) => void;
  onTranslated?: (
    m: Message,
    translated: string,
    targetLang: string,
  ) => unknown; // history write, fire-and-forget
}
type Translation = { state: 'loading' | 'done' | 'error'; text: string };
export function MessageBubble({
  message,
  mine,
  myId,
  corrections,
  reactions,
  otherName,
  pinned,
  showTail,
  replyTo,
  translateTo,
  translateApi,
  onCorrect,
  onSave,
  onReact,
  onAccept,
  onDismiss,
  onReply,
  onPin,
  onDeleteMe,
  onDeleteAll,
  onTranslated,
}: Props) {
  const [saved, setSaved] = useState(false);
  const [tr, setTr] = useState<Translation | null>(null);
  const [sheet, setSheet] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  useMessageGestures(rowRef, {
    onSwipeRight: () => {
      if (!message.deleted_at) onReply(message);
    },
    onLongPress: () => setSheet(true),
  });
  const translate = async () => {
    if (tr?.state === 'done') return setTr(null); // second tap hides it
    setTr({ state: 'loading', text: '' });
    try {
      const out = await translateText(message.body, translateTo, translateApi);
      setTr({ state: 'done', text: out });
      // Store every completed translation for the history tab (skips "already your language"),
      // keyed by the ISO 639-3 id rather than whatever the API was called with.
      if (out.trim().toLowerCase() !== message.body.trim().toLowerCase())
        onTranslated?.(message, out, translateTo);
    } catch (e) {
      setTr({ state: 'error', text: (e as Error).message });
    }
  };
  const alreadyMine =
    tr?.state === 'done' &&
    tr.text.trim().toLowerCase() === message.body.trim().toLowerCase();
  const gone = !!message.deleted_at || message.body === '[deleted]';
  if (gone) return null;
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
          </p>
          {/* Desktop hover: 3-dots trigger. Touch uses long-press (gesture hook). */}
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
      {tr && (
        <div
          className="ft-card max-w-[82%] px-2.5 py-1.5 text-sm"
          aria-live="polite"
        >
          {tr.state === 'loading' && <p className="text-muted">Translating…</p>}
          {tr.state === 'error' && <p className="text-danger">{tr.text}</p>}
          {tr.state === 'done' &&
            (alreadyMine ? (
              <p className="text-muted">
                This looks like it's already in your language.
              </p>
            ) : (
              <>
                <p className="ft-selectable whitespace-pre-wrap break-words">
                  {tr.text}
                </p>
                <p className="mt-0.5 text-2xs text-muted">
                  Machine translation by MyMemory
                </p>
              </>
            ))}
        </div>
      )}
      <>
        {/* <ReactionBar
          reactions={reactions}
          myId={myId}
          onToggle={(emoji) => onReact(message, emoji)}
        /> */}
        <div className="flex gap-3 px-1.5 text-xs leading-tight text-muted">
          {!mine && (
            <button
              className="hover:text-brand"
              onClick={() => onCorrect(message)}
            >
              Correct
            </button>
          )}
          {!mine && (
            <button
              className="hover:text-brand disabled:opacity-60"
              disabled={tr?.state === 'loading'}
              onClick={translate}
            >
              {tr?.state === 'done' ? 'Hide translation' : 'Translate'}
            </button>
          )}
          <button
            className="hover:text-brand disabled:text-success"
            disabled={saved}
            onClick={async () => {
              await onSave(
                message,
                tr?.state === 'done' && !alreadyMine ? tr.text : undefined,
              );
              setSaved(true);
            }}
          >
            {saved ? 'Saved' : 'Save phrase'}
          </button>
        </div>
      </>
      {corrections.map((c) => (
        <CorrectionCard
          key={c.id}
          correction={c}
          original={message.body}
          isOwner={mine}
          correctorName={otherName}
          onAccept={onAccept}
          onDismiss={onDismiss}
        />
      ))}
      {sheet && (
        <MessageActions
          message={message}
          mine={mine}
          pinned={pinned}
          onClose={() => setSheet(false)}
          onReply={() => onReply(message)}
          onPin={() => onPin(message)}
          onDeleteMe={() => onDeleteMe(message)}
          onDeleteAll={() => onDeleteAll(message)}
          onReact={(emoji) => onReact(message, emoji)}
        />
      )}
    </div>
  );
}
