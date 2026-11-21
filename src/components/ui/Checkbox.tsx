import clsx from 'clsx';
import type { ReactNode } from 'react';

/** A checkbox with its label beside it. Used for agreements and on/off settings. */
export function Checkbox({ checked, onChange, children, disabled, className }: {
  checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <label className={clsx('flex items-start gap-3 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', className)}>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--c-brand))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}
