import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { navItems } from './nav';
import { useUnreadCount } from '@/hooks/useUnreadCount';
export function BottomNav() {
  const unread = useUnreadCount();
  return (
    <nav className="ft-safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden">
      {navItems.filter((i) => !i.desktopOnly).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => clsx('flex h-[var(--layout-bottomNavH)] flex-1 items-center justify-center', isActive ? 'text-brand' : 'text-muted')}><span className="relative"><Icon size={24} />{to === '/messages' && unread > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-danger" />}</span></NavLink>
      ))}
    </nav>
  );
}
