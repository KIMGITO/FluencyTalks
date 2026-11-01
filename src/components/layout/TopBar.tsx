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
      {/* Phones: just the mark; the full name from sm up */}
      <span className="sm:hidden"><Logo to="/home" compact /></span>
      <span className="hidden sm:block"><Logo to="/home" /></span>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <NotificationBell />
        <Link to="/profile" aria-label="Your profile">
          <Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="xs" />
        </Link>
      </div>
    </header>
  );
}
