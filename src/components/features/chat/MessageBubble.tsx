import { useState } from 'react';
import clsx from 'clsx';
import { CorrectionCard } from './CorrectionCard';
import { ReactionBar } from './ReactionBar';
import { formatTime } from '@/lib/format';
import { translateText } from '@/lib/translate';
import type { Correction, Message, Reaction } from '@/types/db';

interface Props {
  message: Message; mine: boolean; myId: string; corrections: Correction[]; reactions: Reaction[]; otherName: string;
  translateTo: string;   // language code the viewer wants translations in (their native language)
  onCorrect: (m: Message) => void; onSave: (m: Message, translation?: string) => Promise<unknown>; onReact: (m: Message, emoji: string) => Promise<void>;
  onAccept: (c: Correction) => Promise<void>; onDismiss: (c: Correction) => Promise<void>;
  onTranslated?: (m: Message, translated: string, targetLang: string) => unknown;   // history write, fire-and-forget
}
type Translation = { state: 'loading' | 'done' | 'error'; text: string };
export function MessageBubble({ message, mine, myId, corrections, reactions, otherName, translateTo, onCorrect, onSave, onReact, onAccept, onDismiss, onTranslated }: Props) {
  const [saved, setSaved] = useState(false); const [tr, setTr] = useState<Translation | null>(null);
  const translate = async () => {
    if (tr?.state === 'done') return setTr(null);   // second tap hides it
    setTr({ state: 'loading', text: '' });
    try {
      const out = await translateText(message.body, translateTo);
      setTr({ state: 'done', text: out });
      // Store every completed translation for the history tab (skips "already your language").
      if (out.trim().toLowerCase() !== message.body.trim().toLowerCase()) onTranslated?.(message, out, translateTo);
    }
    catch (e) { setTr({ state: 'error', text: (e as Error).message }); }
  };
  const alreadyMine = tr?.state === 'done' && tr.text.trim().toLowerCase() === message.body.trim().toLowerCase();
  return (
    <div className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div className={clsx('max-w-[80%] rounded-lg px-3 py-1.5 md:px-4 md:py-2', mine ? 'bg-grad-brand text-on-brand' : 'bg-surface-2 text-ink')}>
        <p className={clsx('ft-selectable whitespace-pre-wrap break-words', message.deleted_at && 'italic opacity-70')}>{message.deleted_at ? 'Message deleted' : message.body}</p>
        <p className="mt-0.5 text-2xs opacity-70">{formatTime(message.created_at)}{message.edited_at && ' · edited'}</p>
      </div>
      {tr && (
        <div className="ft-card max-w-[80%] px-3 py-2 text-sm" aria-live="polite">
          {tr.state === 'loading' && <p className="text-muted">Translating…</p>}
          {tr.state === 'error' && <p className="text-danger">{tr.text}</p>}
          {tr.state === 'done' && (alreadyMine ? <p className="text-muted">This looks like it's already in your language.</p>
            : <><p className="ft-selectable whitespace-pre-wrap break-words">{tr.text}</p><p className="mt-1 text-2xs text-muted">Machine translation by MyMemory</p></>)}
        </div>)}
      {!message.deleted_at && (<>
        <ReactionBar reactions={reactions} myId={myId} onToggle={(emoji) => onReact(message, emoji)} />
        <div className="flex gap-3 px-2 text-xs text-muted">
          {!mine && <button className="hover:text-brand" onClick={() => onCorrect(message)}>Correct</button>}
          {!mine && <button className="hover:text-brand disabled:opacity-60" disabled={tr?.state === 'loading'} onClick={translate}>{tr?.state === 'done' ? 'Hide translation' : 'Translate'}</button>}
          <button className="hover:text-brand disabled:text-success" disabled={saved}
            onClick={async () => { await onSave(message, tr?.state === 'done' && !alreadyMine ? tr.text : undefined); setSaved(true); }}>{saved ? 'Saved' : 'Save phrase'}</button>
        </div></>)}
      {corrections.map((c) => <CorrectionCard key={c.id} correction={c} original={message.body} isOwner={mine} correctorName={otherName} onAccept={onAccept} onDismiss={onDismiss} />)}
    </div>
  );
}
