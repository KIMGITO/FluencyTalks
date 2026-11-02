import { Home, Search, MessageCircle, GraduationCap, Coins, User, Shield, BookOpen, type LucideIcon } from 'lucide-react';
export interface NavItem { to: string; label: string; icon: LucideIcon; desktopOnly?: boolean; mobileOnly?: boolean; staffOnly?: boolean; fabOnly?: boolean }
export const navItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search, desktopOnly: true },   // phones reach it from the top bar
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/learning', label: 'Learning', icon: GraduationCap },
  { to: '/bounty-queue', label: 'Bounties', icon: Coins },
  { to: '/profile', label: 'Profile', icon: User },   // last phone tab: the conventional bottom-right spot. Settings lives in the top bar
  { to: '/admin', label: 'Moderation', icon: Shield, desktopOnly: true, staffOnly: true },   
];
