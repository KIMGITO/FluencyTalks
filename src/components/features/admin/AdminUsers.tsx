import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, Input, Spinner } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { ModerationDialog, type ModTarget } from './ModerationDialog';
import { adminSearchUsers } from '@/services';
import { useProfileStore } from '@/store/profileStore';
import type { AdminUser } from '@/types/db';

/** Look someone up and change their status. With an empty search it lists suspended and banned people first. */
export function AdminUsers() {
  const me = useProfileStore((s) => s.me); const [query, setQuery] = useState(''); const [users, setUsers] = useState<AdminUser[] | null>(null); const [error, setError] = useState(''); const [target, setTarget] = useState<ModTarget | null>(null); const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => { setError(''); adminSearchUsers(query.trim()).then(setUsers).catch((e) => { setError((e as Error).message); setUsers([]); }); }, 300);
    return () => clearTimeout(t);
  }, [query, tick]);
  // Moderators may only act on regular users; the server enforces this too.
  const canAct = (u: AdminUser) => u.id !== me?.id && (me?.role === 'admin' || u.role === 'user');
  return (
    <div className="space-y-4">
      <Input aria-label="Search people" placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="text-danger">{error}</p>}
      {!users ? <div className="flex justify-center p-6"><Spinner /></div> : !users.length ? <EmptyState title="No one found" /> : users.map((u) => (
        <Card key={u.id} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Link to={`/u/${u.username}`} className="block truncate font-semibold hover:underline">{u.display_name ?? u.username}</Link>
            <p className="truncate text-sm text-muted">@{u.username}{u.role !== 'user' && ` · ${u.role}`}{u.open_reports > 0 && ` · ${u.open_reports} open report${u.open_reports > 1 ? 's' : ''}`}</p>
          </div>
          <StatusBadge status={u.status} />
          {canAct(u) && (<div className="flex gap-2">
            {u.status === 'active' && <Button size="sm" variant="secondary" onClick={() => setTarget({ userId: u.id, name: u.display_name ?? u.username, status: 'suspended' })}>Suspend</Button>}
            {u.status !== 'banned' && <Button size="sm" variant="danger" onClick={() => setTarget({ userId: u.id, name: u.display_name ?? u.username, status: 'banned' })}>Ban</Button>}
            {u.status !== 'active' && <Button size="sm" onClick={() => setTarget({ userId: u.id, name: u.display_name ?? u.username, status: 'active' })}>Reinstate</Button>}
          </div>)}
        </Card>))}
      <ModerationDialog target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); setTick((n) => n + 1); }} />
    </div>
  );
}
