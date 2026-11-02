import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Avatar } from '@/components/ui';
import { navItems } from './nav';
import { NavBadge } from './NavBadge';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { useProfileStore } from '@/store/profileStore';

/** Phone navigation: a floating dark pill that slides away while scrolling down and returns on scroll up. */
export function BottomNav() {
  const me = useProfileStore((s) => s.me);
  const providerAvatar = useProviderAvatar();
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
                {to === '/profile'
                  ? <span aria-hidden className={clsx('flex rounded-full', isActive && 'ring-2 ring-on-deep')}><Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="xs" /></span>
                  : <Icon size={21} aria-hidden />}
                <NavBadge to={to} ring="ring-deep" className="left-[calc(50%+4px)] -top-1" />
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
