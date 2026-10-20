import { NavLink, Link } from 'react-router-dom';
import clsx from 'clsx';
import { SquarePen } from 'lucide-react';
import { navItems } from './nav';
import { useUnreadCount } from '@/hooks/useUnreadCount';
/** Mobile bar keeps 5 core tabs (Create stays out so it never crowds).
 *  A floating + button above the bar is the always-visible story writer. */
export function BottomNav() {
  const unread = useUnreadCount();
  const tabs = navItems.filter((i) => !i.desktopOnly && !i.fabOnly);
  return (
    <>
      <Link to="/posts/new?type=story" aria-label="Write a story"
        className="fixed bottom-[calc(var(--layout-bottomNavH)+14px)] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-pop transition hover:opacity-90 md:hidden">
        <SquarePen size={24} />
      </Link>
      <nav className="ft-safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => clsx('flex h-[var(--layout-bottomNavH)] flex-1 items-center justify-center', isActive ? 'text-brand' : 'text-muted')}><span className="relative"><Icon size={24} />{to === '/messages' && unread > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-danger" />}</span></NavLink>
        ))}
      </nav>
    </>
  );
}
