import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Logo, ThemeToggle, Avatar } from '@/components/ui';
import { NotificationBell } from '@/components/features/NotificationBell';
import { useProfileStore } from '@/store/profileStore';
export function TopBar() {
  const me = useProfileStore((s) => s.me); const nav = useNavigate(); const [q, setQ] = useState('');
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbarH)] items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <Link to="/home"><Logo /></Link>
      <form className="relative hidden max-w-md flex-1 sm:block" onSubmit={(e) => { e.preventDefault(); nav(`/discover?q=${encodeURIComponent(q)}`); }}>
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" aria-label="Search people" className="w-full rounded-full bg-surface-2 py-2 pl-10 pr-4 text-sm" />
      </form>
      <div className="flex items-center gap-2"><ThemeToggle /><NotificationBell /><Link to="/profile"><Avatar name={me?.display_name ?? 'U'} src={me?.avatar_url} size="sm" /></Link></div>
    </header>
  );
}
