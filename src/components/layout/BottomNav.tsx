import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { navItems } from './nav';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';

/** Phone navigation: a floating dark pill that slides away while scrolling down and returns on scroll up. */
export function BottomNav() {
  const unread = useUnreadCount();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useHideOnScroll();
  useEffect(() => setHidden(false), [pathname]);
  const tabs = navItems.filter((i) => !i.desktopOnly && !i.fabOnly);
  return (
    <nav
      aria-label="Main"
      onFocus={() => setHidden(false)}
      className={clsx(
        'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-20 flex rounded-full border border-on-deep/10 bg-deep/90 px-1.5 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.45)] backdrop-blur-md md:hidden',
        'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none',
        hidden ? 'pointer-events-none translate-y-[calc(100%+env(safe-area-inset-bottom,0px)+1.5rem)] opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => clsx('relative flex h-[var(--layout-bottomNavH)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors', isActive ? 'text-on-deep' : 'text-on-deep/60')}>
          {({ isActive }) => (
            <>
              <span className={clsx('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-on-deep/10')}>
                <Icon size={21} aria-hidden />
                {to === '/messages' && unread > 0 && <span className="absolute right-2.5 top-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-deep" aria-label="Unread messages" />}
              </span>
              <span className="max-w-full truncate px-0.5">{label}</span>
              {isActive && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
