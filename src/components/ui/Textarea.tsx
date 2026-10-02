import clsx from 'clsx';
import type { TextareaHTMLAttributes } from 'react';
export const Textarea = ({ label, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) => (
  <label className="block">
    {label && <span className="mb-1 block text-sm font-medium text-muted">{label}</span>}
    <textarea className={clsx('w-full rounded-md border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted', className)} {...rest} />
  </label>
);
