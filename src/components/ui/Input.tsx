import clsx from 'clsx';
import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/* Omit the native numeric `size` attribute so it doesn't clash with ours. */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  error?: string;
  size?: InputSize;
};

/* Full class names are listed so Tailwind can detect them at build time. */
const sizes: Record<InputSize, { input: string; label: string; message: string }> = {
  xs: { input: 'h-8 rounded-sm px-2.5 text-xs', label: 'mb-1 text-xs', message: 'mt-1 text-xs' },
  sm: { input: 'h-10 rounded-md px-3 text-sm', label: 'mb-1 text-sm', message: 'mt-1 text-xs' },
  md: { input: 'h-12 rounded-md px-4 text-base', label: 'mb-1 text-sm', message: 'mt-1 text-sm' },
  lg: { input: 'h-14 rounded-lg px-5 text-lg', label: 'mb-1.5 text-base', message: 'mt-1.5 text-sm' },
  xl: { input: 'h-16 rounded-lg px-6 text-xl', label: 'mb-2 text-lg', message: 'mt-2 text-base' },
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, size = 'md', className, id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const s = sizes[size];

    return (
      <label className="block" htmlFor={inputId}>
        {label && <span className={clsx('block font-medium text-muted', s.label)}>{label}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            'w-full border bg-surface text-ink placeholder:text-muted transition duration-200',
            'focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-danger focus:ring-danger/30' : 'border-border hover:border-brand/50 focus:border-brand focus:ring-brand/30',
            s.input,
            className,
          )}
          {...rest}
        />
        {error && (
          <span id={errorId} role="alert" className={clsx('block text-danger', s.message)}>
            {error}
          </span>
        )}
      </label>
    );
  },
);
Input.displayName = 'Input';