import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Message } from '@/types/db';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import type { SendOptions } from '@/services';

const BOUNTY_COST = 50;


export function Composer({ onSend, replyTo, onCancelReply, onType }: { onSend: (text: string, opts: SendOptions) => Promise<void>; replyTo?: Message | null; onCancelReply?: () => void; onType?: () => void }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [isBounty, setIsBounty] = useState(false);
  const me = useProfileStore((s) => s.me);
  const nameOf = useLanguageStore((s) => s.name);
  
  const mine = [me?.learning_language_id, me?.native_language_id].filter((x): x is string => !!x);
  const [language, setLanguage] = useState<string>('');
  useEffect(() => { if (!language || !mine.includes(language)) setLanguage(mine[0] ?? ''); }, [me?.native_language_id, me?.learning_language_id]);
  const canAfford = (me?.points_balance ?? 0) >= BOUNTY_COST;

  const submit = async () => {
    if (!text.trim() || busy) return; setBusy(true); setError('');
    try { await onSend(text, { language: language || undefined, bounty: isBounty }); setText(''); setIsBounty(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="border-t border-border p-2.5 md:p-3">
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {replyTo && !replyTo.deleted_at && replyTo.body !== '[deleted]' && (
        <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-brand bg-brand-soft px-2.5 py-1.5 text-xs" aria-live="polite">
          <div className="min-w-0 flex-1 truncate"><span className="font-semibold text-brand">Replying to </span><span className="text-ink">{replyTo.body.slice(0, 120)}</span></div>
          <button aria-label="Cancel reply" onClick={onCancelReply} className="shrink-0 rounded-full p-1 text-muted hover:bg-surface hover:text-ink"><X size={14} /></button>
        </div>)}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {mine.length > 1 && (
            <label className="flex items-center gap-1.5">Writing in
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1 text-ink">
                {mine.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-1.5" title={canAfford ? undefined : `You need ${BOUNTY_COST} points`}>
            <input type="checkbox" checked={isBounty} onChange={(e) => setIsBounty(e.target.checked)} disabled={!canAfford} />
            Ask the community ({BOUNTY_COST} points)
          </label>
        </div>
        {isBounty && <p className="text-xs text-muted">Speakers of {language ? nameOf(language) : 'this language'} will see this message in the bounty queue. {BOUNTY_COST} points are held; whoever's correction you accept gets them, or you get them back after 48 hours.</p>}
        <div className="flex items-end gap-2">
          <textarea rows={1} value={text} maxLength={4000} placeholder="Write a message…" onChange={(e) => { setText(e.target.value); onType?.(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted" />
          <Button aria-label="Send" onClick={submit} disabled={!text.trim() || busy}><Send size={18} /></Button>
        </div>
      </div>
    </div>
  );
}
