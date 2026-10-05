import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, Spinner, tabClass } from '@/components/ui';
import { FOLLOW_PAGE_SIZE } from '@/lib/constants';
import { getProfile, listFollows, type MiniUser } from '@/services';
import type { FullProfile } from '@/types/db';

/** /u/:username/followers and /u/:username/following. The server returns nothing for private accounts you don't follow, so we explain that instead of showing a blank list. */
export default function FollowList({ kind }: { kind: 'followers' | 'following' }) {
  const { username = '' } = useParams();
  const [profile, setProfile] = useState<FullProfile | null | undefined>(undefined); const [users, setUsers] = useState<MiniUser[] | null>(null);
  const [more, setMore] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const locked = !!profile && profile.is_private && !profile.relationship.is_me && profile.relationship.following !== 'accepted';

  useEffect(() => {
    setProfile(undefined); setUsers(null); setMore(false); setError('');
    getProfile(username).then(async (p) => {
      setProfile(p);
      if (!p || (p.is_private && !p.relationship.is_me && p.relationship.following !== 'accepted')) return;
      const first = await listFollows(p.id, kind); setUsers(first); setMore(first.length === FOLLOW_PAGE_SIZE);
    }).catch((e) => { setProfile((p) => p ?? null); setError((e as Error).message); setUsers([]); });
  }, [username, kind]);

  const showMore = async () => {
    if (!profile || !users) return; setBusy(true); setError('');
    try { const next = await listFollows(profile.id, kind, users.length); setUsers([...users, ...next]); setMore(next.length === FOLLOW_PAGE_SIZE); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (profile === undefined || (!locked && profile && !users)) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (profile === null) return <EmptyState title="Profile unavailable" text="This profile doesn't exist or isn't available." action={<Link to="/search"><Button>Search people</Button></Link>} />;
  return (
    <>
      <PageHeader title={profile.display_name} subtitle={`@${profile.username}`} />
      <div className="mb-3 flex gap-2">
        <Link to={`/u/${profile.username}/followers`} className={tabClass(kind === 'followers')}>Followers ({profile.followers_count})</Link>
        <Link to={`/u/${profile.username}/following`} className={tabClass(kind === 'following')}>Following ({profile.following_count})</Link>
        <Link to={`/u/${profile.username}`} className="ml-auto self-center text-sm text-brand hover:underline">View profile</Link>
      </div>
      {error && <p className="mb-3 text-danger">{error}</p>}
      {locked ? <EmptyState title="This account is private" text={`Follow @${profile.username} and get accepted to see who they follow and who follows them.`} />
        : !users?.length ? <EmptyState title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />
        : (<ul className="ft-card divide-y divide-border">{users.map((u) => (
            <li key={u.id}><Link to={`/u/${u.username}`} className="flex items-center gap-2.5 p-2.5 hover:bg-surface-2 md:p-3">
              <Avatar name={u.display_name} src={u.avatar_url} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{u.display_name}</p><p className="truncate text-xs text-muted">@{u.username}</p></div>
            </Link></li>))}</ul>)}
      {!locked && more && <div className="mt-4 flex justify-center"><Button variant="secondary" loading={busy} onClick={showMore}>Show more</Button></div>}
    </>
  );
}
