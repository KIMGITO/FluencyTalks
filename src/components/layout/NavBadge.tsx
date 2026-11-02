import { CountBadge } from '@/components/ui';
import { useNavBadge } from '@/hooks/useNavBadge';

const LABEL: Record<string, string> = { '/messages': 'unread', '/home': 'new partners', '/library': 'new posts', '/bounty-queue': 'new or waiting' };

/** The red count on a nav item. Sits on its icon's top-right corner. */
export function NavBadge({ to, ring, className = '-right-2.5 -top-1.5' }: { to: string; ring: string; className?: string }) {
  return <CountBadge count={useNavBadge(to)} label={LABEL[to] ?? 'new'} ring={ring} className={className} />;
}
