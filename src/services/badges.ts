import { rpc } from '@/lib/api';

/** Tabs whose "new" count the server keeps; Messages and the bell are counted from their own data. */
export type BadgeTab = 'home' | 'library' | 'bounties';
export type NavBadges = Partial<Record<BadgeTab, number>>;

export const navBadges = () => rpc<NavBadges>('nav_badges');
export const markTabSeen = (tab: BadgeTab) => rpc('mark_tab_seen', { p_tab: tab });
