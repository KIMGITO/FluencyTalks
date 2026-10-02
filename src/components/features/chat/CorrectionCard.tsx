import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui';
import { DiffText } from './DiffText';
import type { Correction } from '@/types/db';

/** Learner (message owner) sees Accept / Dismiss. The corrector sees the status of their suggestion. */
export function CorrectionCard({ correction, original, isOwner, correctorName, onAccept, onDismiss }: {
  correction: Correction; original: string; isOwner: boolean; correctorName: string;
  onAccept: (c: Correction) => Promise<void>; onDismiss: (c: Correction) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (correction.status === 'dismissed') return null;
  const act = (fn: (c: Correction) => Promise<void>) => async () => { setBusy(true); setError(''); try { await fn(correction); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const accepted = correction.status === 'accepted';
  return (
    <div className="ft-card max-w-[85%] space-y-2 border-success/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">{accepted ? <Check size={16} className="text-success" /> : <Pencil size={16} className="text-brand" />}
        {accepted ? (isOwner ? 'Correction accepted and saved to your phrasebook' : 'Your correction was accepted') : isOwner ? `${correctorName} suggests` : 'Your suggestion, waiting for a reply'}</p>
      <DiffText original={original} corrected={correction.suggested_text} />
      {correction.note && <p className="text-muted">{correction.note}</p>}
      {error && <p className="text-danger">{error}</p>}
      {isOwner && !accepted && <div className="flex gap-2"><Button size="sm" loading={busy} onClick={act(onAccept)}>Accept and save</Button><Button size="sm" variant="secondary" disabled={busy} onClick={act(onDismiss)}>Dismiss</Button></div>}
    </div>
  );
}
