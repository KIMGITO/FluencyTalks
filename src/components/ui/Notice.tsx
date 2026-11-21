import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export type NoticeTone = 'info' | 'warning' | 'success' | 'danger';
const TONES: Record<NoticeTone, string> = {
  info: 'bg-brand-soft text-ink',
  warning: 'bg-warning/10 text-warning',
  success: 'border border-success/40 bg-success/5 text-ink',
  danger: 'bg-danger/10 text-danger',
};

/** A flat box that draws attention to one message. `small` for tight spaces. */
export const Notice = ({ tone = 'info', small, className, ...p }: HTMLAttributes<HTMLDivElement> & { tone?: NoticeTone; small?: boolean }) => (
  <div className={clsx('rounded-md', small ? 'p-2 text-xs' : 'p-3 text-sm', TONES[tone], className)} {...p} />
);
