import { useState } from 'react';
import { Button } from '@/components/ui';
import { follow, unfollow, type FollowStatus } from '@/services';
const labels = { none: 'Follow', pending: 'Requested', accepted: 'Following' } as const;
export function FollowButton({ userId, initial }: { userId: string; initial: FollowStatus | null }) {
  const [status, setStatus] = useState<FollowStatus | null>(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const toggle = async () => {
    setBusy(true); setError('');
    try { if (status) { await unfollow(userId); setStatus(null); } else setStatus(await follow(userId)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (<span><Button size="sm" variant={status ? 'secondary' : 'primary'} loading={busy} onClick={toggle}>{labels[status ?? 'none']}</Button>{error && <span className="ml-2 text-sm text-danger">{error}</span>}</span>);
}
