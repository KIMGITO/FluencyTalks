import { useEffect } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation, useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, Flag, HeartPulse, LayoutDashboard, ListChecks, LogOut, ScrollText, ShieldCheck, UserCog, Users, type LucideIcon } from 'lucide-react';
import { Logo, Toaster } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import type { StaffTier } from '@/services/admin';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

interface Section { to: string; label: string; subtitle: string; icon: LucideIcon; fullAdmin?: boolean }
const GROUPS: { label: string; sections: Section[] }[] = [
  { label: 'Moderation', sections: [
    { to: '/admin', label: 'Overview', subtitle: 'What needs you, and how the community is doing', icon: LayoutDashboard },
    { to: '/admin/reports', label: 'Reports', subtitle: 'Every report from the community, waiting for a decision', icon: Flag },
    { to: '/admin/decisions', label: 'Decisions', subtitle: 'Appeals, escalations, restrictions and the accountability policy', icon: ListChecks },
    { to: '/admin/people', label: 'People', subtitle: 'Find anyone, and suspend, ban or reinstate them', icon: Users },
    { to: '/admin/activity', label: 'Activity', subtitle: 'What the moderation team has done', icon: Activity },
  ] },
  { label: 'System', sections: [
    { to: '/admin/team', label: 'Team', subtitle: 'Staff accounts and invitations', icon: UserCog, fullAdmin: true },
    { to: '/admin/health', label: 'Health', subtitle: 'Services, database, uptime and security', icon: HeartPulse, fullAdmin: true },
    { to: '/admin/logs', label: 'Logs', subtitle: 'Application errors, the staff audit trail and sign-ins', icon: ScrollText, fullAdmin: true },
  ] },
  { label: 'Your account', sections: [
    { to: '/admin/security', label: 'Security', subtitle: 'Your authenticators, recovery codes and password', icon: ShieldCheck },
  ] },
];
const TIER_LABEL: Record<StaffTier, string> = { super: 'Super admin', admin: 'Admin', moderator: 'Moderator' };

export const useStaffTier = () => useOutletContext<StaffTier>();

export function AdminLayout() {
  const tier = useStaffTier();
  const { user, signOut } = useAuthStore();
  const startNotifications = useNotificationStore((s) => s.start); const stopNotifications = useNotificationStore((s) => s.stop);
  const { pathname } = useLocation();
  useEffect(() => { if (!user?.id) return; startNotifications(user.id); return stopNotifications; }, [user?.id]);
  const groups = GROUPS.map((g) => ({ ...g, sections: g.sections.filter((s) => !s.fullAdmin || tier !== 'moderator') })).filter((g) => g.sections.length);
  const current = GROUPS.flatMap((g) => g.sections).find((s) => s.to === pathname);
  const itemClass = ({ isActive }: { isActive: boolean }) => clsx('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-bold transition-colors', isActive ? 'ft-nav-active bg-on-deep/10 text-on-deep' : 'text-on-deep/65 hover:bg-on-deep/10 hover:text-on-deep');

  return (
    <div className="min-h-screen bg-bg md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <ScrollRestoration />
      <aside className="bg-deep md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-between md:overflow-y-auto md:p-3">
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:gap-5 md:overflow-visible md:p-0 md:pt-2">
          {groups.map((g) => (
            <div key={g.label} className="flex shrink-0 gap-1 md:flex-col">
              <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-deep/55 md:block">{g.label}</p>
              {g.sections.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end className={itemClass}><Icon size={18} aria-hidden /> {label}</NavLink>)}
            </div>
          ))}
        </nav>
        <div className="hidden space-y-1 md:block">
          <button type="button" className={clsx(itemClass({ isActive: false }), 'w-full')} onClick={() => void signOut()}><LogOut size={18} aria-hidden /> Sign out</button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-3 border-b border-border bg-bg px-3 md:px-6">
          <span className="sm:hidden"><Logo to="/admin" compact /></span>
          <span className="hidden sm:block"><Logo to="/admin" /></span>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden min-w-0 text-right text-xs sm:block"><span className="block font-bold">{TIER_LABEL[tier]}</span><span className="block truncate text-muted">{user?.email}</span></span>
            <NotificationBell />
            <button type="button" aria-label="Sign out" className="p-2 text-muted hover:text-ink md:hidden" onClick={() => void signOut()}><LogOut size={20} aria-hidden /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl py-4 md:px-6 md:py-6">
          {current && (
            <div className="ft-inset mb-4 md:mb-6">
              <h1 className="font-display text-3xl font-medium leading-tight">{current.label}</h1>
              <p className="mt-1 text-sm text-muted">{current.subtitle}</p>
            </div>
          )}
          <Outlet context={tier} />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
