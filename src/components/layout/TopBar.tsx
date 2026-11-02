import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Logo, buttonClass } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-2 border-b border-border bg-bg px-3 sm:gap-4 sm:px-4">
      {/* Phones: just the mark; the full name from sm up */}
      <span className="sm:hidden"><Logo to="/home" compact /></span>
      <span className="hidden sm:block"><Logo to="/home" /></span>
      <div className="ml-auto flex items-center">
        {/* Phones: search lives here; from md up it's in the sidebar */}
        <Link to="/search" aria-label="Search" className={`${buttonClass('ghost', 'sm')} h-10 w-10 px-0 md:hidden`}><Search size={20} aria-hidden /></Link>
        <NotificationBell />
      </div>
    </header>
  );
}
