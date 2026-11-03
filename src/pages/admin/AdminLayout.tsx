import { useEffect } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation, useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { CirclePause, LogOut, WifiOff } from 'lucide-react';
import { Avatar, CountBadge, Logo, ThemeToggle, Toaster } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import { Chip } from '@/components/features/admin/AdminKit';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAction } from '@/hooks/useAction';
import { useOnline } from '@/hooks/useOnline';
import type { StaffTier } from '@/services/admin';
import { useAdminStore } from '@/store/adminStore';
import { useAppStatusStore } from '@/store/appStatusStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useProfileStore } from '@/store/profileStore';
import { AdminBottomNav } from './AdminBottomNav';
import { ADMIN_GROUPS, TIER_LABEL, badgeFor, groupsFor, sectionFor } from './adminNav';

export const useStaffTier = () => useOutletContext<StaffTier>();

export function AdminLayout() {
  const tier = useStaffTier();
  const { user, signOut } = useAuthStore();
  const me = useProfileStore((s) => s.me);
  const startNotifications = useNotificationStore((s) => s.start); const stopNotifications = useNotificationStore((s) => s.stop);
  const { overview, refresh, reset } = useAdminStore();
  const { pathname } = useLocation();
  const online = useOnline();
  const paused = useAppStatusStore((s) => s.status?.paused);
  const leave = useAction(signOut, { error: "Couldn't sign you out. Please try again." });
  useEffect(() => { if (!user?.id) return; startNotifications(user.id); return stopNotifications; }, [user?.id]);
  useEffect(() => { void refresh(); }, [pathname]);
  useEffect(() => reset, []);
  const name = me?.display_name ?? user?.email ?? 'Staff';
  const section = sectionFor(pathname);
  const group = section && ADMIN_GROUPS.find((g) => g.sections.includes(section));
  const showTitle = section && section.to === pathname && section.to !== '/admin';   // Overview opens with its own greeting

  return (
    <div className="min-h-screen bg-bg md:grid md:grid-cols-[var(--layout-sidebarCompactW)_minmax(0,1fr)] lg:grid-cols-[var(--layout-sidebarW)_minmax(0,1fr)]">
      <ScrollRestoration />
      <aside className="sticky top-0 hidden h-screen flex-col justify-between gap-4 overflow-y-auto bg-deep p-3 md:flex">
        <div className="space-y-5">
          <span className="flex justify-center lg:hidden"><Logo light compact to="/admin" /></span>
          <span className="hidden px-2 lg:block"><Logo light to="/admin" /></span>
          <nav aria-label="Admin" className="space-y-5">
            {groupsFor(tier).map((g) => (
              <div key={g.label} className="space-y-1">
                <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-deep/55 lg:block">{g.label}</p>
                {g.sections.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} title={label} aria-current={section?.to === to ? 'page' : undefined} className={clsx('flex items-center justify-center gap-3 rounded-md p-2.5 text-sm font-bold transition-colors lg:justify-start', section?.to === to ? 'ft-nav-active bg-on-deep/10 text-on-deep' : 'text-on-deep/65 hover:bg-on-deep/10 hover:text-on-deep')}>
                    <span className="relative"><Icon size={20} aria-hidden /><CountBadge count={badgeFor(to, overview)} label="waiting" ring="ring-deep" className="-right-2.5 -top-1.5 lg:hidden" /></span>
                    <span className="hidden flex-1 lg:inline">{label}</span>
                    {badgeFor(to, overview) > 0 && <span aria-hidden className="hidden rounded-full bg-accent px-1.5 text-xs font-bold tabular-nums text-deep lg:inline">{badgeFor(to, overview)}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="space-y-1 border-t border-on-deep/15 pt-3">
          <p className="hidden items-center gap-2.5 px-2 pb-1 lg:flex">
            <Avatar name={name} size="sm" />
            <span className="min-w-0 text-xs text-on-deep"><b className="block truncate">{name}</b><span className="block truncate text-on-deep/65">{TIER_LABEL[tier]}</span></span>
          </p>
          <button type="button" title="Sign out" aria-busy={leave.busy} disabled={leave.busy} onClick={() => void leave.run()} className="flex w-full items-center justify-center gap-3 rounded-md p-2.5 text-sm font-bold text-on-deep/65 transition-colors hover:bg-on-deep/10 hover:text-on-deep disabled:opacity-60 lg:justify-start">
            {leave.busy ? <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <LogOut size={20} aria-hidden />}
            <span className="hidden lg:inline">{leave.busy ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-3 border-b border-border bg-bg/90 px-3 backdrop-blur-md md:px-6">
          <span className="md:hidden"><Logo to="/admin" compact /></span>
          <p className="hidden min-w-0 truncate text-sm text-muted md:block">{group && <>{group.label} <span aria-hidden>/</span> </>}<b className="text-ink">{section?.label ?? 'Admin'}</b></p>
          <div className="flex min-w-0 items-center gap-1">
            <span className="mr-1"><Chip tone={tier === 'super' ? 'accent' : tier === 'admin' ? 'brand' : 'aqua'}>{TIER_LABEL[tier]}</Chip></span>
            <span className="hidden md:block"><ThemeToggle /></span>
            <NotificationBell allTo="/admin/notifications" />
          </div>
        </header>
        {paused && <p role="status" className="flex items-center justify-center gap-2 bg-danger px-3 py-1.5 text-xs font-semibold text-surface"><CirclePause size={14} aria-hidden /> The app is paused for users. Only staff can use it.</p>}
        {!online && <p role="status" className="flex items-center justify-center gap-2 bg-deep px-3 py-1.5 text-xs font-semibold text-on-deep"><WifiOff size={14} aria-hidden /> You're offline. Decisions and changes need a connection.</p>}
        <main className="mx-auto w-full max-w-5xl py-4 pb-[calc(var(--layout-bottomNavH)+2.5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:py-6 md:pb-8">
          <div key={pathname} className="ft-page">
            {showTitle && (
              <>
                <p className="ft-kicker ft-inset mb-1"><span aria-hidden className="h-px w-5 bg-accent" />{group?.label}</p>
                <PageHeader title={section.label} subtitle={section.subtitle} />
              </>
            )}
            <Outlet context={tier} />
          </div>
        </main>
      </div>
      <AdminBottomNav tier={tier} name={name} email={user?.email} signingOut={leave.busy} onSignOut={() => void leave.run()} />
      <Toaster />
    </div>
  );
}
