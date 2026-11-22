import { Home, Users, MessageCircle, User, type LucideIcon } from 'lucide-react';
export interface NavItem { to: string; label: string; icon: LucideIcon; desktopOnly?: boolean; mobileOnly?: boolean; fabOnly?: boolean }
// Four tabs. Library, Bounties, Learning and Settings are reached from Home and the profile; search is in the top bar.
export const navItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/people', label: 'People', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/profile', label: 'Profile', icon: User },   // last phone tab: the conventional bottom-right spot
];
