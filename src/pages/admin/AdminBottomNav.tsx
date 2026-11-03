import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { LayoutGrid, LogOut, X } from 'lucide-react';
import { Avatar, Button, CountBadge, ThemeToggle } from '@/components/ui';
import { IconTile } from '@/components/features/admin/AdminKit';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import type { StaffTier } from '@/services/admin';
import { useAdminStore } from '@/store/adminStore';
import { TIER_LABEL, badgeFor, groupsFor, sectionFor } from './adminNav';

const tabClass = (active: boolean) => clsx('relative flex h-[var(--layout-bottomNavH)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors', active ? 'text-on-deep' : 'text-on-deep/60');
const TabIcon = ({ active, children }: { active: boolean; children: React.ReactNode }) => <span className={clsx('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-on-deep/10')}>{children}</span>;
const Dot = () => <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />;

/** The phone's navigation: the same floating pill as the learner app. What doesn't fit on it opens from More. */
export function AdminBottomNav({ tier, name, email, signingOut, onSignOut }: { tier: StaffTier; name: string; email?: string; signingOut: boolean; onSignOut: () => void }) {
  const { pathname } = useLocation();
  const overview = useAdminStore((s) => s.overview);
  const [hidden, setHidden] = useHideOnScroll();
  const [more, setMore] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setHidden(false); setMore(false); }, [pathname]);
  useEffect(() => {
    if (!more) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [more]);
  const groups = groupsFor(tier);
  const sections = groups.flatMap((g) => g.sections);
  const inMore = !!sectionFor(pathname) && !sectionFor(pathname).tab;
  return (
    <>
      <nav
        aria-label="Admin"
        onFocus={() => setHidden(false)}
        className={clsx(
          'ft-hide-on-keyboard fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-20 flex rounded-full border border-on-deep/10 bg-deep/90 px-1.5 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.45)] backdrop-blur-md md:hidden',
          'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none',
          hidden && !more ? 'pointer-events-none translate-y-[calc(100%+env(safe-area-inset-bottom,0px)+1.5rem)] opacity-0' : 'translate-y-0 opacity-100',
        )}
      >
        {sections.filter((s) => s.tab).map(({ to, label, icon: Icon }) => {
          const active = sectionFor(pathname)?.to === to;
          return (
            <NavLink key={to} to={to} end={to === '/admin'} className={tabClass(active)}>
              <TabIcon active={active}><Icon size={21} aria-hidden /><CountBadge count={badgeFor(to, overview)} label="waiting" ring="ring-deep" className="left-[calc(50%+4px)] -top-1" /></TabIcon>
              <span className="max-w-full truncate px-0.5">{label}</span>
              {active && <Dot />}
            </NavLink>
          );
        })}
        <button type="button" aria-haspopup="dialog" aria-expanded={more} onClick={() => setMore(true)} className={tabClass(inMore || more)}>
          <TabIcon active={inMore || more}><LayoutGrid size={21} aria-hidden /></TabIcon>
          <span>More</span>
          {inMore && <Dot />}
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 flex items-end bg-deep/60 md:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-modal="true" aria-label="More" className="ft-sheet max-h-[85dvh] w-full space-y-4 overflow-y-auto rounded-t-[1.25rem] bg-surface p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Avatar name={name} />
              <p className="min-w-0 flex-1 text-sm"><b className="block truncate">{name}</b><span className="block truncate text-xs text-muted">{TIER_LABEL[tier]}{email && ` · ${email}`}</span></p>
              <ThemeToggle />
              <Button ref={closeRef} variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label="Close" onClick={() => setMore(false)}><X size={20} aria-hidden /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sections.filter((s) => !s.tab).map(({ to, label, icon, tone }) => (
                <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className={clsx('flex items-center gap-2.5 rounded-lg border p-2.5 text-sm font-bold transition-colors', pathname === to ? 'border-ink bg-surface-2' : 'border-border hover:bg-surface-2')}>
                  <IconTile icon={icon} tone={tone} small /> {label}
                </Link>
              ))}
            </div>
            <Button full className="py-2.5" variant="danger" loading={signingOut} onClick={onSignOut}><LogOut size={18} aria-hidden /> {signingOut ? 'Signing out…' : 'Sign out'}</Button>
          </div>
        </div>
      )}
    </>
  );
}
