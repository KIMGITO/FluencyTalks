import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ban, CirclePause, Flag, RotateCcw, Search, UserSearch } from 'lucide-react';
import { Avatar, Card, EmptyState, ErrorState, Input, RowListSkeleton, Select } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { ModerationDialog, type ModTarget } from './ModerationDialog';
import { ActionMenu, Chip, IconTile, type MenuAction } from './AdminKit';
import { adminSearchUsers } from '@/services';
import type { AccountStatus, AdminUser } from '@/types/db';

const LIMIT = 50;   // what admin_search_users returns at most, people who aren't active first

export function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'all') as AccountStatus | 'all';
  const [query, setQuery] = useState(''); const [users, setUsers] = useState<AdminUser[] | null>(null); const [failed, setFailed] = useState(false); const [searching, setSearching] = useState(false); const [target, setTarget] = useState<ModTarget | null>(null); const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true; setSearching(true);
    const t = setTimeout(() => {
      adminSearchUsers(query.trim()).then((u) => { if (live) { setUsers(u); setFailed(false); } }).catch(() => { if (live) setFailed(true); }).finally(() => { if (live) setSearching(false); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [query, tick]);
  const shown = users?.filter((u) => status === 'all' || u.status === status) ?? null;
  const actionsFor = (u: AdminUser): MenuAction[] => {
    const name = u.display_name ?? u.username;
    return [
      ...(u.status === 'active' ? [{ label: 'Suspend', icon: CirclePause, onSelect: () => setTarget({ userId: u.id, name, status: 'suspended' }) }] : []),
      ...(u.status !== 'banned' ? [{ label: 'Ban', icon: Ban, danger: true, onSelect: () => setTarget({ userId: u.id, name, status: 'banned' }) }] : []),
      ...(u.status !== 'active' ? [{ label: 'Reinstate', icon: RotateCcw, onSelect: () => setTarget({ userId: u.id, name, status: 'active' }) }] : []),
    ];
  };
  return (
    <div className="space-y-4">
      <div className="ft-inset grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-muted">{searching ? <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-border border-t-ink" aria-label="Searching" role="status" /> : <Search size={18} aria-hidden />}</span>
          <Input aria-label="Search people" placeholder="Search by name or username" className="!pl-10 sm:h-12" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select className="border-border" aria-label="Filter by status" value={status} onChange={(e) => setParams(e.target.value === 'all' ? {} : { status: e.target.value }, { replace: true })}>
          <option value="all">Everyone</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </Select>
      </div>
      {failed && !users ? <ErrorState title="Couldn't load people" onRetry={() => setTick((n) => n + 1)} busy={searching} />
        : !shown ? <RowListSkeleton label="Loading people" />
        : !shown.length ? <EmptyState icon={<IconTile icon={UserSearch} />} title="No one found" text={query || status !== 'all' ? 'Try another name, or change the filter.' : undefined} />
        : (
          <>
            <p className="ft-inset text-xs text-muted" aria-live="polite">{shown.length} {shown.length === 1 ? 'person' : 'people'}{users!.length === LIMIT && ' from the first 50 matches. Search to narrow it down.'}</p>
            <Card pad={false} className="divide-y divide-border">
              {shown.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-surface-2/50 md:px-4">
                  <Link to={`/admin/people/${u.username}`} className="group flex min-w-0 flex-1 basis-[12rem] items-center gap-3">
                    <Avatar name={u.display_name ?? u.username} />
                    <span className="min-w-0"><span className="block truncate font-semibold group-hover:underline">{u.display_name ?? u.username}</span><span className="block truncate text-sm text-muted">@{u.username}</span></span>
                  </Link>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {u.role !== 'user' && <Chip tone="brand"><span className="capitalize">{u.role}</span></Chip>}
                    {u.open_reports > 0 && <Chip tone="danger" icon={Flag}>{u.open_reports} open</Chip>}
                    <StatusBadge status={u.status} />
                  </span>
                  {u.manageable && <span className="ml-auto"><ActionMenu label={`Moderate ${u.display_name ?? u.username}`} actions={actionsFor(u)} /></span>}
                </div>
              ))}
            </Card>
          </>
        )}
      <ModerationDialog target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); setTick((n) => n + 1); }} />
    </div>
  );
}
