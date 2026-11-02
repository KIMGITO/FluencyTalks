import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { navItems } from './nav';
import { NavBadge } from './NavBadge';
import { useProfileStore } from '@/store/profileStore';

/** The dark structural column (the 30% colour): icons on a tablet, icons and labels on a laptop. */
export function Sidebar() {
  const role = useProfileStore((s) => s.me?.role); const staff = role === 'admin' || role === 'moderator';
  return (
    <aside className="sticky top-[var(--layout-topbarH)] hidden h-[calc(100dvh-var(--layout-topbarH))] flex-col justify-between bg-deep p-3 md:flex">
      <nav className="flex flex-col gap-1" aria-label="Main">
        {navItems.filter((i) => !i.staffOnly || staff).filter((i) => !i.fabOnly).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} title={label} className={({ isActive }) => clsx('flex items-center justify-center gap-3 rounded-md p-3 font-bold transition-colors lg:justify-start', isActive ? 'ft-nav-active bg-on-deep/10 text-on-deep' : 'text-on-deep/65 hover:bg-on-deep/10 hover:text-on-deep')}>
            <span className="relative"><Icon size={22} /><NavBadge to={to} ring="ring-deep" /></span><span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
      <p className="hidden gap-3 px-3 text-xs text-on-deep/55 lg:flex">
        <Link to="/privacy" className="hover:text-on-deep hover:underline">Privacy</Link>
        <Link to="/terms" className="hover:text-on-deep hover:underline">Terms</Link>
        <Link to="/data-deletion" className="hover:text-on-deep hover:underline">Delete my data</Link>
      </p>
    </aside>
  );
}
