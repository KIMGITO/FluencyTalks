import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Coins, Send, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Message } from '@/types/db';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import { composerLanguages, languageTabLabel, pickComposerLanguage } from '@/lib/composerLanguages';
import type { SendOptions } from '@/services';

const BOUNTY_COST = 50;

/** One row: language tab(s), bounty toggle, the text, send. The language tag decides who may correct and who sees a bounty. */
export function Composer({ onSend, replyTo, onCancelReply, onType }: { onSend: (text: string, opts: SendOptions) => Promise<void>; replyTo?: Message | null; onCancelReply?: () => void; onType?: (typing: boolean) => void }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [isBounty, setIsBounty] = useState(false);
  const me = useProfileStore((s) => s.me);
  const nameOf = useLanguageStore((s) => s.name);

  const mine = composerLanguages(me);
  const [language, setLanguage] = useState<string>(() => pickComposerLanguage(mine, null));
  useEffect(() => { setLanguage((cur) => pickComposerLanguage(mine, cur)); }, [me?.native_language_id, me?.learning_language_id]);
  const canAfford = (me?.points_balance ?? 0) >= BOUNTY_COST;

  const submit = async () => {
    if (!text.trim() || busy) return; setBusy(true); setError('');
    try { await onSend(text, { language: language || undefined, bounty: isBounty }); setText(''); setIsBounty(false); onType?.(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="border-t border-border bg-surface px-2 py-1.5 md:px-3 md:py-2">
      {error && <p role="alert" className="mb-1 text-xs text-danger">{error}</p>}
      {replyTo && !replyTo.deleted_at && replyTo.body !== '[deleted]' && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border-l-2 border-brand bg-brand-soft px-2.5 py-1 text-xs" aria-live="polite">
          <div className="min-w-0 flex-1 truncate text-ink"><span className="font-semibold">Replying to </span>{replyTo.body.slice(0, 120)}</div>
          <button aria-label="Cancel reply" onClick={onCancelReply} className="shrink-0 rounded-full p-1 text-muted hover:bg-surface hover:text-ink"><X size={14} /></button>
        </div>)}
      {isBounty && (
        <p className="mb-1 px-0.5 text-xs text-muted" aria-live="polite">
          <span className="font-semibold text-ink">Bounty on.</span> {BOUNTY_COST} points held. {language ? nameOf(language) : 'Qualified'} speakers can answer; refunded after 48 h if you accept none.
        </p>)}
      <div className="flex items-end gap-1.5">
        <div className="flex h-11 shrink-0 items-center gap-1">
          {mine.length > 1 ? (
            <div role="radiogroup" aria-label="Message language" className="flex h-11 items-stretch rounded-md border border-border bg-surface-2 p-1">
              {mine.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={language === id} aria-label={nameOf(id)} title={nameOf(id)} onClick={() => setLanguage(id)}
                  className={clsx('min-w-9 rounded px-1.5 text-xs font-bold tracking-wide transition', language === id ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>
                  {languageTabLabel(id)}
                </button>))}
            </div>
          ) : mine.length === 1 ? (
            <span title={`Writing in ${nameOf(mine[0])}`} className="flex h-11 items-center rounded-md border border-border bg-surface-2 px-2.5 text-xs font-bold tracking-wide text-ink">{languageTabLabel(mine[0])}</span>
          ) : null}
          <button type="button" aria-pressed={isBounty} disabled={!canAfford && !isBounty} onClick={() => setIsBounty(!isBounty)}
            aria-label={`Ask the community (${BOUNTY_COST} points)`} title={canAfford ? `Ask the community (${BOUNTY_COST} points)` : `You need ${BOUNTY_COST} points for a bounty`}
            className={clsx('flex h-11 w-11 items-center justify-center rounded-md border transition disabled:opacity-40', isBounty ? 'border-accent bg-accent text-deep' : 'border-border text-muted hover:bg-surface-2 hover:text-ink')}>
            <Coins size={18} aria-hidden />
          </button>
        </div>
        <textarea rows={1} value={text} maxLength={4000} placeholder="Write a message…" aria-label="Message" onChange={(e) => { setText(e.target.value); onType?.(!!e.target.value.trim()); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
          className="max-h-32 min-w-0 flex-1 resize-none rounded-md border border-border bg-bg px-3 py-[9px] text-base text-ink transition duration-200 placeholder:text-muted hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40" />
        <Button aria-label="Send" className="h-11 w-11 shrink-0 px-0" onClick={submit} disabled={!text.trim() || busy}><Send size={18} /></Button>
      </div>
    </div>
  );
}
