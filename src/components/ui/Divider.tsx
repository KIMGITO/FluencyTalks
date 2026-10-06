import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export type DividerPosition = 's' | 'ns' | 'c' | 'ne' | 'e';

export type DividerProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
  position?: DividerPosition;
};

const POSITION_MAP: Record<DividerPosition, { left: string; right: string }> = {
  s:  { left: 'hidden', right: 'flex-1' },
  ns: { left: 'flex-1', right: 'flex-[4]' },
  c:  { left: 'flex-1', right: 'flex-1' },
  ne: { left: 'flex-[4]', right: 'flex-1' },
  e:  { left: 'flex-1', right: 'hidden' },
};

/** A rule that separates sections of a list. `label` puts a caption in the specified position. */
export const Divider = ({
  className,
  label,
  position = 'c',
  ...p
}: DividerProps) => {
  const { left, right } = POSITION_MAP[position] ?? POSITION_MAP.c;

  return label ? (
    <div
      className={clsx('flex items-center gap-2 py-1', className)}
      role="separator"
      aria-label={label}
      {...p}
    >
      <span className={clsx('h-px bg-border', left)} />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className={clsx('h-px bg-border', right)} />
    </div>
  ) : (
    <div className={clsx('h-px w-full bg-border', className)} role="separator" {...p} />
  );
};