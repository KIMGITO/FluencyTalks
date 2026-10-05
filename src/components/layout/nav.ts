import { Home, Search, MessageCircle, BookMarked, User, Settings, Shield, type LucideIcon } from 'lucide-react';
export interface NavItem { to: string; label: string; icon: LucideIcon; desktopOnly?: boolean; staffOnly?: boolean }
export const navItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/phrasebook', label: 'Phrasebook', icon: BookMarked, desktopOnly: true },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Moderation', icon: Shield, desktopOnly: true, staffOnly: true },   // admins and moderators only; on mobile it is reached from Settings
];
