import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { userMessage } from '@/lib/errors';
import { cleanText, limitLength } from '@/lib/validate';

/** Before something consequential: says what will happen. Stays open and shows the error if it fails. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, reasonLabel, reasonRequired, onConfirm, onClose }: {
  open: boolean; title: string; children?: ReactNode; confirmLabel: string; danger?: boolean;
  /** Adds a text box; its value is passed to onConfirm. */
  reasonLabel?: string; reasonRequired?: boolean;
  onConfirm: (reason: string) => Promise<unknown>; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) { setReason(''); setError(''); first.current?.focus(); } }, [open]);
  const missing = !!reasonRequired && !cleanText(reason);
  const go = async () => {
    setBusy(true); setError('');
    try { await onConfirm(cleanText(reason)); onClose(); }
    catch (e) { setError(userMessage(e, 'Oops! Something went wrong. Please try again.')); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title={title}>
      {children && <div className="text-sm text-muted">{children}</div>}
      {reasonLabel && (
        <label className="block text-sm font-semibold text-ink">{reasonLabel}
          <textarea rows={2} value={reason} onChange={(e) => setReason(limitLength(e.target.value, 500))}
            className="mt-1 w-full rounded-md border border-border bg-surface p-2.5 text-base font-normal text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button ref={first} variant="secondary" size="sm" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" loading={busy} disabled={missing} onClick={go}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
