import { useEffect, useState } from 'react';
import { Avatar, Button } from '@/components/ui';
import { listBlocked, unblockUser, type MiniUser } from '@/services';
export function BlockedList() {
  const [users, setUsers] = useState<MiniUser[] | null>(null);
  useEffect(() => { listBlocked().then(setUsers).catch(() => setUsers([])); }, []);
  if (!users) return null;
  if (!users.length) return <p className="text-sm text-muted">You haven't blocked anyone.</p>;
  return (<ul className="space-y-2">{users.map((u) => (
    <li key={u.id} className="flex items-center gap-3"><Avatar name={u.display_name} src={u.avatar_url} size="sm" /><span className="flex-1 truncate">{u.display_name}</span>
      <Button size="sm" variant="secondary" onClick={async () => { await unblockUser(u.id); setUsers(users.filter((x) => x.id !== u.id)); }}>Unblock</Button></li>))}</ul>);
}
