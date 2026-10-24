import { Home, Search, MessageCircle, GraduationCap, Coins, User, Settings, Shield, BookOpen, type LucideIcon } from 'lucide-react';
export interface NavItem { to: string; label: string; icon: LucideIcon; desktopOnly?: boolean; mobileOnly?: boolean; staffOnly?: boolean; fabOnly?: boolean }
export const navItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/learning', label: 'Learning', icon: GraduationCap, desktopOnly: true },
  { to: '/bounty-queue', label: 'Bounties', icon: Coins, desktopOnly: true },   
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Moderation', icon: Shield, desktopOnly: true, staffOnly: true },   
];
