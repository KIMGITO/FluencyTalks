import { Activity, CircleHelp, Flag, HeartPulse, LayoutDashboard, ListChecks, Newspaper, ScrollText, ShieldCheck, UserCog, Users, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/features/admin/AdminKit';
import type { AdminOverview, StaffTier } from '@/services/admin';

/** `tab`: gets its own place on the phone's bottom bar. The rest live behind More. */
export interface AdminSection { to: string; label: string; subtitle: string; icon: LucideIcon; tone: Tone; tab?: boolean; fullAdmin?: boolean }
export const ADMIN_GROUPS: { label: string; sections: AdminSection[] }[] = [
  { label: 'Moderation', sections: [
    { to: '/admin', label: 'Overview', subtitle: 'What needs you, and how the community is doing', icon: LayoutDashboard, tone: 'brand', tab: true },
    { to: '/admin/reports', label: 'Reports', subtitle: 'Every report from the community, waiting for a decision', icon: Flag, tone: 'accent', tab: true },
    { to: '/admin/decisions', label: 'Decisions', subtitle: 'Appeals, escalations, restrictions and the accountability policy', icon: ListChecks, tone: 'sun', tab: true },
    { to: '/admin/people', label: 'People', subtitle: 'Find anyone, and suspend, ban or reinstate them', icon: Users, tone: 'aqua', tab: true },
    { to: '/admin/activity', label: 'Activity', subtitle: 'What the moderation team has done', icon: Activity, tone: 'brand' },
  ] },
  { label: 'Content', sections: [
    { to: '/admin/blog', label: 'Blog', subtitle: 'Write, preview and publish posts for the public blog', icon: Newspaper, tone: 'accent' },
    { to: '/admin/faq', label: 'FAQ', subtitle: 'The questions on the FAQ page and the home page', icon: CircleHelp, tone: 'aqua' },
  ] },
  { label: 'System', sections: [
    { to: '/admin/team', label: 'Team', subtitle: 'Staff accounts and invitations', icon: UserCog, tone: 'aqua', fullAdmin: true },
    { to: '/admin/health', label: 'Health', subtitle: 'Services, database, uptime and security', icon: HeartPulse, tone: 'success', fullAdmin: true },
    { to: '/admin/logs', label: 'Logs', subtitle: 'Application errors, the staff audit trail and sign-ins', icon: ScrollText, tone: 'muted', fullAdmin: true },
  ] },
  { label: 'Your account', sections: [
    { to: '/admin/security', label: 'Security', subtitle: 'Your authenticators, recovery codes and password', icon: ShieldCheck, tone: 'sun' },
  ] },
];
export const TIER_LABEL: Record<StaffTier, string> = { super: 'Super admin', admin: 'Admin', moderator: 'Moderator' };

export const groupsFor = (tier: StaffTier) => ADMIN_GROUPS.map((g) => ({ ...g, sections: g.sections.filter((s) => !s.fullAdmin || tier !== 'moderator') })).filter((g) => g.sections.length);

/** The section a path belongs to, so /admin/people/someone still lights up People. */
export const sectionFor = (pathname: string) => ADMIN_GROUPS.flatMap((g) => g.sections).filter((s) => pathname === s.to || (s.to !== '/admin' && pathname.startsWith(`${s.to}/`)))[0];

/** The count that sits on a nav item: only things waiting on staff. */
export const badgeFor = (to: string, o: AdminOverview | null) => (!o ? 0 : to === '/admin/reports' ? o.reports_open : to === '/admin/decisions' ? o.appeals_open + o.decisions_escalated : 0);
