import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { Logo, buttonClass } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import { navItems } from './nav';

/** Pages with their own way out: the four tabs, and a chat thread (its header has a back arrow). */
const ownWayOut = (path: string) => navItems.some((i) => i.to === path) || path.startsWith('/messages/');

export function TopBar() {
  const { pathname, key } = useLocation(); const nav = useNavigate();
  const showBack = !ownWayOut(pathname);
  // Opened straight from a link or a notification there's no page to go back to, so it goes home.
  const back = () => (key !== 'default' ? nav(-1) : nav('/home', { replace: true }));
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-2 border-b border-border bg-bg px-3 sm:gap-4 sm:px-4">
      {showBack && (
        <button type="button" onClick={back} aria-label="Back" title="Back" className={`${buttonClass('ghost', 'sm')} -ml-1.5 h-10 w-10 shrink-0 !px-0`}>
          <ArrowLeft size={22} aria-hidden />
        </button>)}
      {/* Phones: just the mark; the full name from sm up */}
      <span className="sm:hidden"><Logo to="/home" compact /></span>
      <span className="hidden sm:block"><Logo to="/home" /></span>
      <div className="ml-auto flex items-center">
        {/* Search lives here on every screen size */}
        <Link to="/search" aria-label="Search" className={`${buttonClass('ghost', 'sm')} h-10 w-10 px-0`}><Search size={20} aria-hidden /></Link>
        <NotificationBell />
      </div>
    </header>
  );
}
