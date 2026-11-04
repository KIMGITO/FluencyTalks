import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { submitDiscussion, type ItemKind } from '@/services/review';
import { cleanText, limitLength } from '@/lib/validate';

const FIELD = 'w-full rounded-md border border-border bg-surface p-2.5 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40';
/** Someone showed you their mistakes in public: the copy asks for kindness and shows the text ready to edit. */
const HELP_COPY = {
  story: { field: 'Your fixed sentence', label: 'Explain the fix', placeholder: 'Be kind: they are learning. What changed, and why?', send: 'Send fix' },
  photo: { field: 'Your fixed caption', label: 'Explain the fix', placeholder: 'Be kind: they are learning. What changed, and why?', send: 'Send fix' },
  correct_me: { field: 'Your fixed version', label: 'Explain the fix', placeholder: 'Be kind: they are learning. What changed, and why?', send: 'Send fix' },
  how_do_i_say: { field: 'How to say it', label: 'When would you use it?', placeholder: 'A short tip helps them remember it.', send: 'Send answer' },
} as const;

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0').slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);

const COPY: Record<ItemKind, { label: string; placeholder: string; send: string; done: string }> = {
  correction: { label: 'Why is it wrong?', placeholder: 'Explain what is inaccurate', send: 'Propose correction', done: 'Correction sent. The author has been asked to decide.' },
  clarification: { label: 'What do you need to know?', placeholder: 'What is missing or unclear?', send: 'Ask', done: 'Question sent to the author.' },
  comment: { label: 'Your reply', placeholder: 'Write a reply', send: 'Reply', done: 'Reply posted.' },
};

/** Inline, right under what it answers. The key survives a failure, so a retry cannot post twice, and so does the text. */
export function Composer({ postId, parentId, kind, currentPhrase, currentTranslation, helpType, target, noTranslation, onDone, onCancel }: {
  postId: string; parentId: string | null; kind: ItemKind; currentPhrase: string; currentTranslation: string | null;
  /** Set when this is a fix on a help post. */
  helpType?: keyof typeof HELP_COPY;
  /** The stretch of a long post this fixes, counted in characters. */
  target?: { start: number; end: number; text: string } | null;
  noTranslation?: boolean;
  onDone: (id: string) => void; onCancel: () => void;
}) {
  const help = kind === 'correction' && helpType ? HELP_COPY[helpType] : null;
  const [phrase, setPhrase] = useState(kind === 'correction' && (target || helpType === 'correct_me' || helpType === 'photo') ? target?.text ?? currentPhrase : '');
  const [translation, setTranslation] = useState('');
  const [body, setBody] = useState('');
  const key = useRef(newKey());
  const copy = COPY[kind];
  const send = useAction(
    () => submitDiscussion({ post: postId, parent: parentId, kind, body: cleanText(body), phrase: cleanText(phrase) || null, translation: cleanText(translation) || null, clientKey: key.current, targetStart: target?.start, targetEnd: target?.end }),
    { success: help ? 'Sent. Thank you for helping.' : copy.done, silent: true, onDone: (id) => onDone(id as string) },
  );
  const ready = !!cleanText(body) && (kind !== 'correction' || !!cleanText(phrase) || !!cleanText(translation));
  return (
    <form
      noValidate
      className="space-y-2 rounded-md border border-border bg-surface-2/50 p-3"
      onSubmit={(e) => { e.preventDefault(); if (ready) void send.run(); }}
    >
      {kind === 'correction' && (
        <>
          {target && <blockquote className="border-l-2 border-accent pl-2 text-sm text-muted">{target.text}</blockquote>}
          <label className="block text-xs font-semibold text-ink">{help ? help.field : target ? 'Replacement sentence' : 'Replacement phrase'}
            <textarea rows={2} value={phrase} onChange={(e) => setPhrase(limitLength(e.target.value, 1000))} placeholder={help ? undefined : currentPhrase} className={`${FIELD} mt-1 font-normal`} />
          </label>
          {!help && !noTranslation && !target && (
            <label className="block text-xs font-semibold text-ink">Replacement translation (optional)
              <input value={translation} onChange={(e) => setTranslation(limitLength(e.target.value, 500))} placeholder={currentTranslation ?? ''} className={`${FIELD} mt-1 font-normal`} />
            </label>
          )}
        </>
      )}
      <label className="block text-xs font-semibold text-ink">{help ? help.label : copy.label}
        <textarea autoFocus={kind !== 'correction'} rows={2} value={body} onChange={(e) => setBody(limitLength(e.target.value, 1000))} placeholder={help ? help.placeholder : copy.placeholder} className={`${FIELD} mt-1 font-normal`} />
      </label>
      {send.error && <p role="alert" className="text-sm text-danger">{send.error} Your text is still here.</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={send.busy} onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={send.busy} disabled={!ready}>{help ? help.send : copy.send}</Button>
      </div>
    </form>
  );
}
