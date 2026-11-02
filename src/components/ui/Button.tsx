import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; full?: boolean; loading?: boolean };
// The same roles as the public pages: coral = the one thing to press (text on it is always deep indigo, 5.5:1),
// outlined = everything else. Corners are square-ish and the button lifts a little on hover (see .ft-btn).
const variants = {
  primary: 'border border-accent bg-accent text-deep hover:brightness-105',
  secondary: 'border border-ink/30 bg-transparent text-ink hover:bg-surface-2',
  ghost: 'border border-transparent text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border border-danger bg-transparent text-danger hover:bg-danger/10',
};
const sizes = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-4 text-base', lg: 'min-h-12 px-5 text-lg' };
/** The Button look for anything that is not a <button> (a router Link, an <a>). */
export const buttonClass = (variant: keyof typeof variants = 'primary', size: keyof typeof sizes = 'md', full?: boolean) =>
  clsx('ft-btn inline-flex items-center justify-center gap-2 rounded-md font-bold', variants[variant], sizes[size], full && 'w-full');

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'primary', size = 'md', full, loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} aria-busy={loading || undefined} disabled={disabled || loading} className={clsx('ft-btn inline-flex items-center justify-center gap-2 rounded-md font-bold disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], full && 'w-full', className)} {...rest}>
      {loading && <span aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
});
