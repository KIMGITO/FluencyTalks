import clsx from 'clsx';
import type { ItemStatus } from '@/services/review';

const TONE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-success/15 text-success',
  corrected: 'bg-success/15 text-success',
  confirmed: 'bg-success/15 text-success',
  declined: 'bg-surface-2 text-muted',
  superseded: 'bg-surface-2 text-muted',
  withdrawn: 'bg-surface-2 text-muted',
  resolved: 'bg-surface-2 text-ink',
  disputed: 'bg-warning/15 text-warning',
  unreviewed: 'bg-surface-2 text-muted',
  needs_fix: 'bg-warning/15 text-warning',
  helped: 'bg-success/15 text-success',
};
const LABEL: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined', superseded: 'Superseded', withdrawn: 'Withdrawn', resolved: 'Resolved',
  corrected: 'Corrected', confirmed: 'Confirmed', disputed: 'In review', unreviewed: 'Not reviewed',
  needs_fix: 'Needs a fix', helped: 'Helped',
};
export type PillStatus = ItemStatus | 'corrected' | 'confirmed' | 'disputed' | 'unreviewed' | 'needs_fix' | 'helped';

export const StatusPill = ({ status, className }: { status: PillStatus; className?: string }) => (
  <span className={clsx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-bold', TONE[status], className)}>{LABEL[status]}</span>
);
