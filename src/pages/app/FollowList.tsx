import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, Spinner, tabClass } from '@/components/ui';
import { FOLLOW_PAGE_SIZE } from '@/lib/constants';
import { getProfile, listFollows, type MiniUser } from '@/services';
import type { FullProfile } from '@/types/db';
import { FollowButton } from '@/components/features/FollowButton';
import { LanguageChip } from '@/components/features/LanguageChip';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';

export default function FollowList({
  kind,
}: {
  kind: 'followers' | 'following';
}) {
  const { username = '' } = useParams();
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  const [profile, setProfile] = useState<FullProfile | null | undefined>(
    undefined,
  );
  const [users, setUsers] = useState<MiniUser[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked =
    !!profile &&
    profile.is_private &&
    !profile.relationship.is_me &&
    profile.relationship.following !== 'accepted';

  useEffect(() => {
    setProfile(undefined);
    setUsers(null);
    setMore(false);
    setError('');
    getProfile(username)
      .then(async (p) => {
        setProfile(p);
        if (
          !p ||
          (p.is_private &&
            !p.relationship.is_me &&
            p.relationship.following !== 'accepted')
        )
          return;
        const first = await listFollows(p.id, kind);
        setUsers(first);
        setMore(first.length === FOLLOW_PAGE_SIZE);
      })
      .catch((e) => {
        setProfile((p) => p ?? null);
        setError((e as Error).message);
        setUsers([]);
      });
  }, [username, kind]);

  const showMore = async () => {
    if (!profile || !users) return;
    setBusy(true);
    setError('');
    try {
      const next = await listFollows(profile.id, kind, users.length);
      setUsers([...users, ...next]);
      setMore(next.length === FOLLOW_PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (profile === undefined || (!locked && profile && !users))
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  if (profile === null)
    return (
      <EmptyState
        title="Profile unavailable"
        text="This profile doesn't exist or isn't available."
        action={
          <Link to="/search">
            <Button>Search people</Button>
          </Link>
        }
      />
    );
  return (
    <>
      <PageHeader
        title={profile.display_name}
        subtitle={`@${profile.username}`}
      />
      <div className="mb-3 flex gap-2">
        <Link
          to={`/u/${profile.username}/followers`}
          className={tabClass(kind === 'followers')}
        >
          Followers ({profile.followers_count})
        </Link>
        <Link
          to={`/u/${profile.username}/following`}
          className={tabClass(kind === 'following')}
        >
          Following ({profile.following_count})
        </Link>
        <Link
          to={`/u/${profile.username}`}
          className="ml-auto self-center text-sm text-brand hover:underline"
        >
          View profile
        </Link>
      </div>
      {error && <p className="mb-3 text-danger">{error}</p>}
      {locked ? (
        <EmptyState
          title="This account is private"
          text={`Follow @${profile.username} to see their ${kind}.`}
        />
      ) : !users?.length ? (
        <EmptyState
          title={
            kind === 'followers'
              ? 'No followers yet'
              : 'Not following anyone yet'
          }
        />
      ) : (
        <ul className="ft-card divide-y divide-border">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                to={`/u/${u.username}`}
                className="flex items-center gap-2.5 p-2 hover:bg-surface-2 md:p-1"
              >
                <Avatar name={u.display_name} src={u.avatar_url} size="sm" />
                <div className=" flex-1">
                  <div className="flex items-center flex-1 justify-between">
                    <div className="flex flex-col gap-1 flex-1 justify-center">
                      <p className="truncate text-sm font-semibold">
                        {u.display_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        @{u.username}
                      </p>
                    </div>
                    <div className="flex flex-wrap flex-1 max-w-1/2 justify-end gap-1 text-[10px]">
                      {u.languages &&
                        u.languages.length > 0 &&
                        u.languages.map((l, i) => (
                          <p
                            key={i}
                            className="truncate text-[9px] text-muted flex gap-0.5 items-center"
                          >
                            <span>{labelOf(l, locales)}</span>{' '}
                            <span className="text-[8px]">({l.level})</span>,
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!locked && more && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" loading={busy} onClick={showMore}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}
