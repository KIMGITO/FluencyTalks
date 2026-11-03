import clsx from 'clsx';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { limitLength } from '@/lib/validate';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';


/** Checks live in the code that submits (lib/validate), so the browser's own validation attributes aren't accepted here. */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'required' | 'minLength' | 'min' | 'max' | 'pattern'> & {
  label?: string;
  error?: string;
  size?: InputSize;
};


/** These types trigger the browser's own validation. They are plain text fields that keep the phone keyboard they would have had. */
const KEYBOARDS: Partial<Record<string, InputHTMLAttributes<HTMLInputElement>['inputMode']>> = { email: 'email', number: 'numeric', url: 'url', tel: 'tel' };

const sizes: Record<InputSize, { input: string; label: string; message: string }> = {
  xs: { input: 'h-8 rounded-sm px-2.5 text-xs', label: 'mb-1 text-xs', message: 'mt-1 text-xs' },
  sm: { input: 'h-10 rounded-md px-3 text-sm', label: 'mb-1 text-sm', message: 'mt-1 text-xs' },
  md: { input: 'h-12 rounded-md px-4 text-base', label: 'mb-1 text-sm', message: 'mt-1 text-sm' },
  lg: { input: 'h-14 rounded-lg px-5 text-lg', label: 'mb-1.5 text-base', message: 'mt-1.5 text-sm' },
  xl: { input: 'h-16 rounded-lg px-6 text-xl', label: 'mb-2 text-lg', message: 'mt-2 text-base' },
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, size = 'sm', className, id, type, maxLength, onChange, ...rest }, ref) => {
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
          type={(isPassword && reveal) || (type && KEYBOARDS[type]) ? 'text' : type}
          inputMode={type ? KEYBOARDS[type] : undefined}
          autoCapitalize={type === 'email' ? 'none' : undefined}
          spellCheck={type === 'email' ? false : undefined}
          onChange={(e) => { if (maxLength) e.target.value = limitLength(e.target.value, maxLength); onChange?.(e); }}
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