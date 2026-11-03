import clsx from 'clsx';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

const ICON = { success: CheckCircle2, error: TriangleAlert, info: Info };
const TONE = { success: 'text-success', error: 'text-danger', info: 'text-muted' };

/** Above the bottom nav on phones, bottom-right from md. Polite for news, assertive for failures. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="ft-toaster pointer-events-none fixed inset-x-3 bottom-[calc(var(--layout-bottomNavH)+env(safe-area-inset-bottom,0px)+1.5rem)] z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="ft-toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm text-ink shadow-pop">
            <Icon size={18} aria-hidden className={clsx('mt-0.5 shrink-0', TONE[t.kind])} />
            <p className="min-w-0 flex-1 break-words">{t.text}</p>
            {t.retry && (
              <button type="button" onClick={() => { dismiss(t.id); t.retry!(); }} className="shrink-0 font-bold text-ink underline underline-offset-2">Retry</button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><X size={15} aria-hidden /></button>
          </div>
        );
      })}
    </div>
  );
}
