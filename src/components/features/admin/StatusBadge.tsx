import clsx from 'clsx';
import type { AccountStatus } from '@/types/db';
const colors: Record<AccountStatus, string> = { active: 'text-success', suspended: 'text-accent', banned: 'text-danger' };
export const StatusBadge = ({ status }: { status: AccountStatus }) => <span className={clsx('rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold capitalize', colors[status])}>{status}</span>;
