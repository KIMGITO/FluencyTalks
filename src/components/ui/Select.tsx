import clsx from 'clsx';
import type { SelectHTMLAttributes } from 'react';
export const Select = ({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) => (
  <label className="block">
    {label && <span className="mb-1 block text-sm font-medium text-muted">{label}</span>}
    <select className={clsx('w-full rounded-md border border-border bg-surface px-3 py-3 text-base text-ink', className)} {...rest}>{children}</select>
  </label>
);
