import clsx from 'clsx';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';


type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  error?: string;
  size?: InputSize;
};


const sizes: Record<InputSize, { input: string; label: string; message: string }> = {
  xs: { input: 'h-8 rounded-sm px-2.5 text-xs', label: 'mb-1 text-xs', message: 'mt-1 text-xs' },
  sm: { input: 'h-10 rounded-md px-3 text-sm', label: 'mb-1 text-sm', message: 'mt-1 text-xs' },
  md: { input: 'h-12 rounded-md px-4 text-base', label: 'mb-1 text-sm', message: 'mt-1 text-sm' },
  lg: { input: 'h-14 rounded-lg px-5 text-lg', label: 'mb-1.5 text-base', message: 'mt-1.5 text-sm' },
  xl: { input: 'h-16 rounded-lg px-6 text-xl', label: 'mb-2 text-lg', message: 'mt-2 text-base' },
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, size = 'sm', className, id, type, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const s = sizes[size];
    // Password fields get a show/hide toggle.
    const isPassword = type === 'password';
    const [reveal, setReveal] = useState(false);

    return (
      <label className="block" htmlFor={inputId}>
        {label && <span className={clsx('block font-semibold text-ink', s.label)}>{label}</span>}
        <span className="relative block">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            'w-full border bg-surface text-ink placeholder:text-muted transition duration-200',
            'focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-danger focus:ring-danger/30' : 'border-border hover:border-ink/40 focus:border-ink focus:ring-accent/40',
            s.input,
            isPassword && 'pr-10',
            className,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setReveal((r) => !r); }}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-ink focus:outline-none focus-visible:text-ink"
          >
            {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        </span>
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