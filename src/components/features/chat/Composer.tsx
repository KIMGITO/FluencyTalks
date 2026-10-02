import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui';
/** Enter sends, Shift+Enter adds a new line. */
export function Composer({ onSend }: { onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim() || busy) return; setBusy(true); setError('');
    try { await onSend(text); setText(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="border-t border-border p-3">
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea rows={1} value={text} maxLength={4000} placeholder="Write a message…" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted" />
        <Button aria-label="Send" onClick={submit} disabled={!text.trim() || busy}><Send size={18} /></Button>
      </div>
    </div>
  );
}
