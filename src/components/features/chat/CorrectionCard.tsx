import { useState } from 'react';
import { Check, ChevronDown, Coins, MessageSquareReply, Pencil, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import clsx from 'clsx';
import { DiffText } from './DiffText';
import { useChatStore } from '@/store/chatStore';
import { toast } from '@/store/toastStore';
import type { Correction } from '@/types/db';

/** Older declined suggestions stay out of the chat: the question is only asked while it is fresh. */
const RATE_DISMISSED_DAYS = 7;
const REASONS = ['Already correct', 'Changes the meaning', "Doesn't sound natural"];

/** The author says whether a suggestion helped. Decides whether the corrector keeps earning. */
function RateCorrection({ correction }: { correction: Correction }) {
  const rate = useChatStore((s) => s.rate);
  const send = (helpful: boolean) => { rate(correction, helpful).catch((e) => toast.error((e as Error).message)); };
  const button = (helpful: boolean, Icon: typeof ThumbsUp, label: string) => {
    const on = correction.feedback === (helpful ? 'helpful' : 'not_helpful');
    return (
      <button type="button" aria-label={label} aria-pressed={on} title={label} onClick={() => send(helpful)}
        className={clsx('rounded-full p-1 transition', on ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
        <Icon size={13} aria-hidden />
      </button>
    );
  };
  return (
    <span className="ml-auto flex items-center gap-0.5" aria-label="Was this helpful?">
      {button(true, ThumbsUp, 'Helpful')}
      {button(false, ThumbsDown, 'Not helpful')}
    </span>
  );
}

const iconBtn = 'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition disabled:opacity-50';

/**
 * One suggestion under a message, kept to two or three lines: who and what state, the change, the actions.
 * isOwner: it's my message. A bounty answer may come from someone outside the chat, so the name comes
 * from the correction itself, never from the chat partner.
 */
export function CorrectionCard({ correction, original, isOwner, myId, bounty, onAccept, onDecline, onDiscuss }: {
  correction: Correction; original: string; isOwner: boolean; myId: string; bounty: boolean;
  onAccept: (c: Correction) => Promise<void>; onDecline: (c: Correction, reason: string) => Promise<void>;
  /** Only when the corrector is the person you chat with: reply to them about it. */
  onDiscuss?: () => void;
}) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [open, setOpen] = useState(false); const [declining, setDeclining] = useState(false); const [reason, setReason] = useState('');
  const mineToo = correction.corrector_id === myId;
  const who = mineToo ? 'You' : correction.corrector?.display_name || correction.corrector?.username || 'Someone';
  const { status } = correction;

  if (status === 'superseded' && !mineToo) return null;   // another answer won; only its author needs to know
  if (status === 'dismissed') {
    const fresh = Date.now() - new Date(correction.decided_at ?? correction.created_at).getTime() < RATE_DISMISSED_DAYS * 86_400_000;
    if (!fresh || (!isOwner && !mineToo)) return null;
  }

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); setDeclining(false); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const pending = status === 'pending';
  const label = {
    pending: isOwner ? `${who} suggests` : mineToo ? 'Your suggestion · waiting' : `${who} suggested`,
    accepted: isOwner ? 'Accepted · saved to phrasebook' : `Accepted${mineToo ? ' · yours' : ''}`,
    dismissed: `Declined${correction.decision_note ? `: ${correction.decision_note}` : ''}`,
    superseded: 'Another answer was chosen',
  }[status];
  const tone = { pending: 'border-brand', accepted: 'border-success', dismissed: 'border-border', superseded: 'border-border' }[status];
  const Icon = status === 'accepted' ? Check : status === 'pending' ? Pencil : X;

  return (
    <div className={clsx('max-w-[85%] rounded-md border-l-[3px] bg-surface px-2.5 py-1.5 text-sm shadow-card', tone, !pending && status !== 'accepted' && 'opacity-80')}>
      <div className="flex min-h-6 items-center gap-1.5 text-xs text-muted">
        <Icon size={13} aria-hidden className={status === 'accepted' ? 'text-success' : undefined} />
        <span className="min-w-0 truncate font-semibold">{label}</span>
        {bounty && <span title="Bounty answer" className="inline-flex items-center gap-0.5 rounded-sm bg-surface-2 px-1 text-2xs font-bold text-ink"><Coins size={11} aria-hidden /> Bounty</span>}
        {correction.note && (
          <button type="button" aria-expanded={open} aria-label={open ? 'Hide explanation' : 'Show explanation'} title="Explanation"
            onClick={() => setOpen(!open)} className="rounded p-0.5 hover:text-ink">
            <ChevronDown size={14} aria-hidden className={clsx('transition-transform', open && 'rotate-180')} />
          </button>)}
        {isOwner && (status === 'accepted' || status === 'dismissed') && !correction.feedback && <RateCorrection correction={correction} />}
      </div>
      {status !== 'dismissed' && <div className="text-ink"><DiffText original={original} corrected={correction.suggested_text} /></div>}
      {open && correction.note && <p className="mt-0.5 text-xs italic text-muted">{correction.note}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {isOwner && pending && !declining && (
        <div className="-mx-1 mt-1 flex flex-wrap items-center gap-1">
          <button type="button" disabled={busy} onClick={() => run(() => onAccept(correction))} className={clsx(iconBtn, 'bg-accent text-deep hover:brightness-105')}>
            <Check size={14} aria-hidden /> Accept
          </button>
          <button type="button" disabled={busy} onClick={() => setDeclining(true)} className={clsx(iconBtn, 'text-muted hover:bg-surface-2 hover:text-ink')}>
            <X size={14} aria-hidden /> Decline
          </button>
          {onDiscuss && (
            <button type="button" onClick={onDiscuss} className={clsx(iconBtn, 'text-muted hover:bg-surface-2 hover:text-ink')}>
              <MessageSquareReply size={14} aria-hidden /> Discuss
            </button>)}
        </div>)}

      {declining && (
        <form className="mt-1 flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) void run(() => onDecline(correction, reason.trim())); }}>
          <div className="flex flex-wrap gap-1">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={clsx('rounded-full border px-2 py-0.5 text-xs', reason === r ? 'border-brand bg-brand-soft text-ink' : 'border-border text-muted hover:text-ink')}>{r}</button>))}
          </div>
          <div className="flex items-center gap-1">
            <input aria-label="Why are you declining?" placeholder="Why? (they'll see this)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40" />
            <button type="submit" disabled={busy || !reason.trim()} className={clsx(iconBtn, 'bg-surface-2 text-ink')}>Send</button>
            <button type="button" aria-label="Cancel" onClick={() => { setDeclining(false); setReason(''); }} className={clsx(iconBtn, 'px-1.5 text-muted hover:text-ink')}><X size={14} aria-hidden /></button>
          </div>
        </form>)}
    </div>
  );
}
