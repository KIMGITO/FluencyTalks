import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { navItems } from './nav';
import { useUnreadCount } from '@/hooks/useUnreadCount';

/** Phone navigation: a dark bar, small labels, and a coral mark above the page you are on. */
export function BottomNav() {
  const unread = useUnreadCount();
  const tabs = navItems.filter((i) => !i.desktopOnly && !i.fabOnly);
  return (
    <nav aria-label="Main" className="ft-safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-on-deep/10 bg-deep md:hidden">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => clsx('relative flex h-[var(--layout-bottomNavH)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold', isActive ? 'text-on-deep' : 'text-on-deep/60')}>
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-x-3 top-0 h-[3px] bg-accent" aria-hidden />}
              <span className="relative"><Icon size={22} aria-hidden />{to === '/messages' && unread > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" aria-label="Unread messages" />}</span>
              <span className="max-w-full truncate px-0.5">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
