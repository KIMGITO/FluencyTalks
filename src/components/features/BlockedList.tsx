import { useEffect, useState } from 'react';
import { Avatar, Button, PartialError, Skeleton } from '@/components/ui';
import { toast } from '@/store/toastStore';
import { listBlocked, unblockUser, type MiniUser } from '@/services';
export function BlockedList() {
  const [users, setUsers] = useState<MiniUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => { setFailed(false); listBlocked().then(setUsers).catch(() => setFailed(true)); };
  useEffect(load, []);
  if (failed) return <PartialError text="Couldn't load the people you've blocked." onRetry={load} />;
  if (!users) return <Skeleton className="h-9 w-full" />;
  if (!users.length) return <p className="text-sm text-muted">You haven't blocked anyone.</p>;
  return (<ul className="space-y-2">{users.map((u) => (
    <li key={u.id} className="flex items-center gap-3"><Avatar name={u.display_name} src={u.avatar_url} size="sm" /><span className="flex-1 truncate">{u.display_name}</span>
      <Button size="sm" variant="secondary" loading={busy === u.id} onClick={async () => {
        setBusy(u.id);
        try { await unblockUser(u.id); setUsers(users.filter((x) => x.id !== u.id)); toast.success(`${u.display_name} is unblocked.`); }
        catch (e) { toast.error((e as Error).message); }
        finally { setBusy(null); }
      }}>Unblock</Button></li>))}</ul>);
}
