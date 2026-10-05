import { Link } from 'react-router-dom';
import { Logo, ThemeToggle, Avatar } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import { useProfileStore } from '@/store/profileStore';
/** Search lives in its own page (/search, reached from the nav tab), so the bar only holds logo, theme, bell and you. */
export function TopBar() {
  const me = useProfileStore((s) => s.me);
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <Link to="/home"><Logo /></Link>
      <div className="ml-auto flex items-center gap-2"><ThemeToggle /><NotificationBell /><Link to="/profile"><Avatar name={me?.display_name ?? 'U'} src={me?.avatar_url} size="sm" /></Link></div>
    </header>
  );
}
