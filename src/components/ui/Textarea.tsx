import clsx from 'clsx';
import { useId, type TextareaHTMLAttributes } from 'react';
import { limitLength } from '@/lib/validate';

/** Like Input: `maxLength` is enforced here in code, and the browser's own validation attributes aren't accepted. */
type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required' | 'minLength'> & { label?: string; error?: string };

export const Textarea = ({ label, error, className, maxLength, onChange, ...rest }: Props) => {
  const errorId = useId();
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>}
      <textarea
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => { if (maxLength) e.target.value = limitLength(e.target.value, maxLength); onChange?.(e); }}
        className={clsx('w-full rounded-md border bg-surface px-4 py-3 text-base text-ink transition duration-200 placeholder:text-muted focus:outline-none focus:ring-2', error ? 'border-danger focus:ring-danger/30' : 'border-border hover:border-ink/40 focus:border-ink focus:ring-accent/40', className)}
        {...rest}
      />
      {error && <span id={errorId} role="alert" className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
};
