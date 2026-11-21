import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

/** One row in a pop-up menu. `danger` for destructive actions, `quiet` for low-key ones. */
export const MenuItem = ({ danger, quiet, className, type = 'button', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; quiet?: boolean }) => (
  <button type={type} className={clsx('ft-menu-item', danger && 'text-danger hover:bg-danger/10', quiet && 'text-muted', className)} {...p} />
);
