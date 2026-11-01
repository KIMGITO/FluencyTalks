import { Link } from 'react-router-dom';
import { Logo, Avatar } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { useProfileStore } from '@/store/profileStore';

export function TopBar() {
  const me = useProfileStore((s) => s.me);
  const providerAvatar = useProviderAvatar();
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-2 border-b border-border bg-bg px-3 sm:gap-4 sm:px-4">
      <Logo to="/home" />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {me?.points_balance !== undefined && (
          <Link to="/bounty-queue" className="ft-btn whitespace-nowrap rounded-sm border border-border bg-surface px-2 py-1 text-xs font-bold text-ink hover:bg-surface-2" aria-label={`${me.points_balance} points. Open bounties`}>
            {me.points_balance} pts
          </Link>
        )}
        <NotificationBell />
        <Link to="/profile" aria-label="Your profile">
          <Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="xs" />
        </Link>
      </div>
    </header>
  );
}
