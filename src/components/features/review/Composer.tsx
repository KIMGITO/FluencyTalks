import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { submitDiscussion, type ItemKind } from '@/services/review';

const FIELD = 'w-full rounded-md border border-border bg-surface p-2.5 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40';
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0').slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);

const COPY: Record<ItemKind, { label: string; placeholder: string; send: string; done: string }> = {
  correction: { label: 'Why is it wrong?', placeholder: 'Explain what is inaccurate', send: 'Propose correction', done: 'Correction sent. The author has been asked to decide.' },
  clarification: { label: 'What do you need to know?', placeholder: 'What is missing or unclear?', send: 'Ask', done: 'Question sent to the author.' },
  comment: { label: 'Your reply', placeholder: 'Write a reply', send: 'Reply', done: 'Reply posted.' },
};

/** Inline, right under what it answers. The key survives a failure, so a retry cannot post twice, and so does the text. */
export function Composer({ postId, parentId, kind, currentPhrase, currentTranslation, onDone, onCancel }: {
  postId: string; parentId: string | null; kind: ItemKind; currentPhrase: string; currentTranslation: string | null;
  onDone: (id: string) => void; onCancel: () => void;
}) {
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [body, setBody] = useState('');
  const key = useRef(newKey());
  const copy = COPY[kind];
  const send = useAction(
    () => submitDiscussion({ post: postId, parent: parentId, kind, body, phrase: phrase || null, translation: translation || null, clientKey: key.current }),
    { success: copy.done, silent: true, onDone: (id) => onDone(id as string) },
  );
  const ready = !!body.trim() && (kind !== 'correction' || !!phrase.trim() || !!translation.trim());
  return (
    <form
      className="space-y-2 rounded-md border border-border bg-surface-2/50 p-3"
      onSubmit={(e) => { e.preventDefault(); if (ready) void send.run(); }}
    >
      {kind === 'correction' && (
        <>
          <label className="block text-xs font-semibold text-ink">Replacement phrase
            <textarea rows={2} maxLength={500} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={currentPhrase} className={`${FIELD} mt-1 font-normal`} />
          </label>
          <label className="block text-xs font-semibold text-ink">Replacement translation (optional)
            <input maxLength={500} value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder={currentTranslation ?? ''} className={`${FIELD} mt-1 font-normal`} />
          </label>
        </>
      )}
      <label className="block text-xs font-semibold text-ink">{copy.label}
        <textarea autoFocus={kind !== 'correction'} rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={copy.placeholder} className={`${FIELD} mt-1 font-normal`} />
      </label>
      {send.error && <p role="alert" className="text-sm text-danger">{send.error} Your text is still here.</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={send.busy} onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={send.busy} disabled={!ready}>{copy.send}</Button>
      </div>
    </form>
  );
}
