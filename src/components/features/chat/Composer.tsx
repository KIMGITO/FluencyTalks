import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Message } from '@/types/db';
/** Enter sends, Shift+Enter adds a new line. Reply preview anchors above the input. */
export function Composer({ onSend, replyTo, onCancelReply, onType }: { onSend: (text: string) => Promise<void>; replyTo?: Message | null; onCancelReply?: () => void; onType?: () => void }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim() || busy) return; setBusy(true); setError('');
    try { await onSend(text); setText(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="border-t border-border p-2.5 md:p-3">
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-brand bg-brand-soft px-2.5 py-1.5 text-xs" aria-live="polite">
          <div className="min-w-0 flex-1 truncate"><span className="font-semibold text-brand">Replying to </span><span className="text-ink">{replyTo.deleted_at ? 'This message was deleted.' : replyTo.body.slice(0, 120)}</span></div>
          <button aria-label="Cancel reply" onClick={onCancelReply} className="shrink-0 rounded-full p-1 text-muted hover:bg-surface hover:text-ink"><X size={14} /></button>
        </div>)}
      <div className="flex items-end gap-2">
        <textarea rows={1} value={text} maxLength={4000} placeholder="Write a message…" onChange={(e) => { setText(e.target.value); onType?.(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted" />
        <Button aria-label="Send" onClick={submit} disabled={!text.trim() || busy}><Send size={18} /></Button>
      </div>
    </div>
  );
}
