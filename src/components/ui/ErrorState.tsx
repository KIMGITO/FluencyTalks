import { Lock, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

/** A failed request is not an empty list: this says it failed and offers the way back. */
export function ErrorState({ title = "Couldn't load this", text, onRetry, busy }: { title?: string; text?: string; onRetry?: () => void; busy?: boolean }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const Icon = offline ? WifiOff : TriangleAlert;
  return (
    <Card role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
      <Icon size={22} aria-hidden className="text-muted" />
      <h3 className="font-display text-xl font-medium">{offline ? "You're offline" : title}</h3>
      <p className="max-w-sm text-sm text-muted">{offline ? 'Check your connection, then try again.' : text ?? 'Something went wrong on our side or with your connection.'}</p>
      {onRetry && <Button size="sm" variant="secondary" loading={busy} onClick={onRetry}><RefreshCw size={14} aria-hidden /> Try again</Button>}
    </Card>
  );
}

export const DeniedState = ({ title = "You can't see this", text, action }: { title?: string; text?: string; action?: ReactNode }) => (
  <Card className="flex flex-col items-center gap-2 py-8 text-center">
    <Lock size={22} aria-hidden className="text-muted" />
    <h3 className="font-display text-xl font-medium">{title}</h3>
    {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
    {action}
  </Card>
);

/** Some of the page loaded; this part didn't. */
export const PartialError = ({ text, onRetry }: { text: string; onRetry?: () => void }) => (
  <p role="alert" className="ft-inset flex flex-wrap items-center gap-2 py-2 text-sm text-muted">
    <TriangleAlert size={15} aria-hidden className="shrink-0 text-danger" /> {text}
    {onRetry && <button type="button" onClick={onRetry} className="font-bold text-ink underline underline-offset-2">Try again</button>}
  </p>
);
