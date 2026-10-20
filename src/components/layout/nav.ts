import { Home, Search, MessageCircle, GraduationCap, User, Settings, Shield, BookOpenText, SquarePen, type LucideIcon } from 'lucide-react';
export interface NavItem { to: string; label: string; icon: LucideIcon; desktopOnly?: boolean; mobileOnly?: boolean; staffOnly?: boolean; fabOnly?: boolean }
export const navItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/posts', label: 'Stories', icon: BookOpenText },
  { to: '/posts/new?type=story', label: 'Create', icon: SquarePen, fabOnly: true },   // one-tap story creation: sidebar + FAB, not the crowded bottom bar
  { to: '/search', label: 'Search', icon: Search },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/learning', label: 'Learning', icon: GraduationCap },
  { to: '/profile', label: 'Profile', icon: User, desktopOnly: true },   // mobile reaches profile via the header avatar; sidebar keeps it on md+
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Moderation', icon: Shield, desktopOnly: true, staffOnly: true },   // admins and moderators only; on mobile it is reached from Settings
];
