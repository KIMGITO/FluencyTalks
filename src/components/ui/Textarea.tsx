import clsx from 'clsx';
import type { TextareaHTMLAttributes } from 'react';
export const Textarea = ({ label, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) => (
  <label className="block">
    {label && <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>}
    <textarea className={clsx('w-full rounded-md border border-border bg-surface px-4 py-3 text-base text-ink transition duration-200 placeholder:text-muted hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40', className)} {...rest} />
  </label>
);
