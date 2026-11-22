import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const chipClass = (active?: boolean) => clsx('inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors',
  active ? 'border-brand bg-brand text-on-brand' : 'border-border bg-surface text-ink hover:bg-surface-2');

/** A rounded filter or shortcut. With `to` it's a link, otherwise a toggle button. */
export function Chip({ active, onClick, to, children, className }: { active?: boolean; onClick?: () => void; to?: string; children: ReactNode; className?: string }) {
  if (to) return <Link to={to} className={clsx(chipClass(active), className)}>{children}</Link>;
  return <button type="button" aria-pressed={active} onClick={onClick} className={clsx(chipClass(active), className)}>{children}</button>;
}
