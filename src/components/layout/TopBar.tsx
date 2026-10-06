import { Link } from 'react-router-dom';
import { Logo, Avatar } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { useProfileStore } from '@/store/profileStore';
/** The header holds logo, bell and you — the small avatar IS the profile button. Falls back to provider photo, then initials. */
export function TopBar() {
  const me = useProfileStore((s) => s.me);
  const providerAvatar = useProviderAvatar();
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <Link to="/home"><Logo /></Link>
      <div className="ml-auto flex items-center gap-1.5"><NotificationBell /><Link to="/profile" aria-label="Your profile"><Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="xs" /></Link></div>
    </header>
  );
}
