import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';
type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };
export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, id, ...rest }, ref) => (
  <label className="block" htmlFor={id}>
    {label && <span className="mb-1 block text-sm font-medium text-muted">{label}</span>}
    <input ref={ref} id={id} className={clsx('w-full rounded-md border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted', error ? 'border-danger' : 'border-border', className)} {...rest} />
    {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
  </label>
));
