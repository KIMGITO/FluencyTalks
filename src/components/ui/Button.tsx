import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; full?: boolean; loading?: boolean };
const variants = {
  primary: 'bg-brand text-on-brand hover:opacity-90',
  secondary: 'bg-surface-2 text-ink hover:bg-border',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-on-brand hover:opacity-90',
};
const sizes = { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2 text-base', lg: 'px-6 py-3 text-lg' };
export function Button({ variant = 'primary', size = 'md', full, loading, className, children, disabled, ...rest }: Props) {
  return (
    <button disabled={disabled || loading} className={clsx('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50', variants[variant], sizes[size], full && 'w-full', className)} {...rest}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}
