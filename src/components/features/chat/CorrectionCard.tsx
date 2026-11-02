import { useState } from 'react';
import { Check, Pencil, ThumbsDown, ThumbsUp } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { DiffText } from './DiffText';
import { useChatStore } from '@/store/chatStore';
import type { Correction } from '@/types/db';

/** Older dismissed suggestions stay out of the chat: the question is only asked while it is fresh. */
const RATE_DISMISSED_DAYS = 7;

/** The author says whether a suggestion helped. Decides whether the corrector keeps earning. */
function RateCorrection({ correction }: { correction: Correction }) {
  const rate = useChatStore((s) => s.rate);
  const [error, setError] = useState('');
  const send = (helpful: boolean) => { setError(''); rate(correction, helpful).catch((e) => setError((e as Error).message)); };
  const button = (helpful: boolean, Icon: typeof ThumbsUp, label: string) => {
    const on = correction.feedback === (helpful ? 'helpful' : 'not_helpful');
    return (
      <button type="button" aria-label={label} aria-pressed={on} title={label} onClick={() => send(helpful)}
        className={clsx('rounded-full p-1.5 transition', on ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
        <Icon size={15} aria-hidden />
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      <span className="mr-1">Was this helpful?</span>
      {button(true, ThumbsUp, 'Helpful')}
      {button(false, ThumbsDown, 'Not helpful')}
      {error && <span className="ml-1 text-danger">{error}</span>}
    </div>
  );
}


export function CorrectionCard({ correction, original, isOwner, correctorName, onAccept, onDismiss }: {
  correction: Correction; original: string; isOwner: boolean; correctorName: string;
  onAccept: (c: Correction) => Promise<void>; onDismiss: (c: Correction) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');

  if (correction.status === 'dismissed') {
    const fresh = Date.now() - new Date(correction.created_at).getTime() < RATE_DISMISSED_DAYS * 86_400_000;
    if (!isOwner || correction.feedback || !fresh) return null;
    return <div className="ft-card max-w-[85%] p-2 px-3"><RateCorrection correction={correction} /></div>;
  }
  const act = (fn: (c: Correction) => Promise<void>) => async () => { setBusy(true); setError(''); try { await fn(correction); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const accepted = correction.status === 'accepted';
  return (
    <div className="ft-card max-w-[85%] space-y-2 border-success/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">{accepted ? <Check size={16} className="text-success" /> : <Pencil size={16} className="text-brand" />}
        {accepted ? (isOwner ? 'Correction accepted and saved to your phrasebook' : 'Your correction was accepted') : isOwner ? `${correctorName} suggests` : 'Your suggestion, waiting for a reply'}</p>
      <DiffText original={original} corrected={correction.suggested_text} />
      {correction.note && <p className="text-muted">{correction.note}</p>}
      {error && <p className="text-danger">{error}</p>}
      {isOwner && accepted && <RateCorrection correction={correction} />}
      {isOwner && !accepted && <div className="flex gap-2"><Button size="sm" loading={busy} onClick={act(onAccept)}>Accept and save</Button><Button size="sm" variant="secondary" disabled={busy} onClick={act(onDismiss)}>Dismiss</Button></div>}
    </div>
  );
}
