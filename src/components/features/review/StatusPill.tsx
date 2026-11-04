import clsx from 'clsx';
import type { ItemStatus } from '@/services/review';

const TONE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-success/15 text-success',
  declined: 'bg-surface-2 text-muted',
  superseded: 'bg-surface-2 text-muted',
  withdrawn: 'bg-surface-2 text-muted',
  resolved: 'bg-surface-2 text-ink',
  awaiting_feedback: 'bg-surface-2 text-muted',
  corrections_received: 'bg-brand-soft text-ink',
  under_review: 'bg-warning/15 text-warning',
  reviewed: 'bg-success/15 text-success',
};
const LABEL: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined', superseded: 'Superseded', withdrawn: 'Withdrawn', resolved: 'Resolved',
  awaiting_feedback: 'Awaiting feedback', corrections_received: 'Corrections received', under_review: 'Under review', reviewed: 'Reviewed',
};
export type PillStatus = ItemStatus | 'awaiting_feedback' | 'corrections_received' | 'under_review' | 'reviewed';

export const StatusPill = ({ status, label, className }: { status: PillStatus; label?: string; className?: string }) => (
  <span className={clsx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-bold', TONE[status], className)}>{label ?? LABEL[status]}</span>
);
