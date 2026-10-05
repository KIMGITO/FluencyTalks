import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

/** A rule that separates sections of a list. `label` puts a caption in the middle of it. */
export const Divider = ({ className, label, ...p }: HTMLAttributes<HTMLDivElement> & { label?: string }) => (
  label
    ? <div className={clsx('flex items-center gap-2 py-1', className)} role="separator" aria-label={label} {...p}>
        <span className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    : <div className={clsx('h-px w-full bg-border', className)} role="separator" {...p} />
);