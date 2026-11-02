import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Coins, Send, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Message } from '@/types/db';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import { composerLanguages, languageTabLabel, pickComposerLanguage } from '@/lib/composerLanguages';
import type { SendOptions } from '@/services';

const BOUNTY_COST = 50;

/** One row, nearly all of it for typing: a small options button (language, bounty), the text, send. The language tag decides who may correct and who sees a bounty. */
export function Composer({ onSend, replyTo, onCancelReply, onType }: { onSend: (text: string, opts: SendOptions) => Promise<void>; replyTo?: Message | null; onCancelReply?: () => void; onType?: (typing: boolean) => void }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [isBounty, setIsBounty] = useState(false); const [optionsOpen, setOptionsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const me = useProfileStore((s) => s.me);
  const nameOf = useLanguageStore((s) => s.name);

  const mine = composerLanguages(me);
  const [language, setLanguage] = useState<string>(() => pickComposerLanguage(mine, null));
  useEffect(() => { setLanguage((cur) => pickComposerLanguage(mine, cur)); }, [me?.native_language_id, me?.learning_language_id]);
  const canOfferBounty = !!language && ((me?.points_balance ?? 0) >= BOUNTY_COST || isBounty);
  const hasOptions = mine.length > 1 || canOfferBounty;
  // The box grows with the text, up to its max height.
  useLayoutEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [text]);

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
        {hasOptions && (
          <div className="relative shrink-0" onKeyDown={(e) => { if (e.key === 'Escape') setOptionsOpen(false); }}>
            <button type="button" aria-label={`Message options: ${nameOf(language)}${isBounty ? ', bounty on' : ''}`} aria-expanded={optionsOpen} onClick={() => setOptionsOpen(!optionsOpen)}
              className={clsx('flex h-[44px] w-[44px] items-center justify-center rounded-md border text-xs font-bold tracking-wide transition active:scale-95', isBounty ? 'border-accent bg-accent text-deep' : 'border-border bg-surface-2 text-ink')}>
              {languageTabLabel(language)}
            </button>
            {optionsOpen && (<>
              <div aria-hidden className="fixed inset-0 z-30" onClick={() => setOptionsOpen(false)} />
              <div className="ft-menu bottom-full left-0 mb-1.5">
                {mine.length > 1 && (
                  <div role="radiogroup" aria-label="Message language">
                    {mine.map((id) => (
                      <button key={id} type="button" role="radio" aria-checked={language === id} onClick={() => { setLanguage(id); setOptionsOpen(false); }} className="ft-menu-item">
                        <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
                        {language === id && <Check size={15} aria-hidden />}
                      </button>))}
                  </div>)}
                {canOfferBounty && (
                  <button type="button" aria-pressed={isBounty} onClick={() => { setIsBounty(!isBounty); setOptionsOpen(false); }} className="ft-menu-item">
                    <Coins size={15} aria-hidden className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate">Bounty · {BOUNTY_COST} points</span>
                    {isBounty && <Check size={15} aria-hidden />}
                  </button>)}
              </div>
            </>)}
          </div>)}
        <textarea ref={inputRef} rows={1} value={text} maxLength={4000} placeholder="Write a message…" aria-label="Message" onChange={(e) => { setText(e.target.value); onType?.(!!e.target.value.trim()); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
          className="max-h-[8rem] min-h-[44px] min-w-0 flex-1 resize-none rounded-md border border-border bg-bg px-3 py-[9px] text-base leading-6 text-ink transition-colors duration-200 placeholder:text-muted hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40" />
        <Button aria-label="Send" className="w-[44px] shrink-0 self-stretch px-0" onClick={submit} disabled={!text.trim() || busy}><Send size={18} /></Button>
      </div>
    </div>
  );
}
