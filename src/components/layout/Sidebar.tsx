import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { navItems } from './nav';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useProfileStore } from '@/store/profileStore';
/** Desktop: icon + label. Tablet: icons only. Hidden on mobile (BottomNav takes over). */
export function Sidebar() {
  const unread = useUnreadCount(); const role = useProfileStore((s) => s.me?.role); const staff = role === 'admin' || role === 'moderator';
  return (
    <aside className="sticky top-[var(--layout-topbarH)] hidden h-[calc(100vh-var(--layout-topbarH))] p-3 md:block">
      <nav className="flex flex-col gap-1">
        {navItems.filter((i) => !i.staffOnly || staff).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} title={label} className={({ isActive }) => clsx('flex items-center justify-center gap-3 rounded-md p-3 font-medium transition lg:justify-start', isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
            <span className="relative"><Icon size={22} />{to === '/messages' && unread > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-danger" />}</span><span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
