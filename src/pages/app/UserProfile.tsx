import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { FollowButton, LanguageChip, MessageButton, UserMenu } from '@/components/features';
import { getProfile } from '@/services';
import { useLanguageStore } from '@/store/languageStore';
import type { FullProfile } from '@/types/db';

export default function UserProfile() {
  const { username = '' } = useParams(); const nameOf = useLanguageStore((s) => s.name);
  const [profile, setProfile] = useState<FullProfile | null | undefined>(undefined);
  useEffect(() => { setProfile(undefined); getProfile(username).then(setProfile).catch(() => setProfile(null)); }, [username]);

  if (profile === undefined) return <div className="flex justify-center p-8"><Spinner /></div>;
  // Same screen for "doesn't exist" and "blocked you": blocking stays silent.
  if (profile === null) return <EmptyState title="Profile unavailable" text="This profile doesn't exist or isn't available." action={<Link to="/discover"><Button>Browse people</Button></Link>} />;
  const r = profile.relationship;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={profile.display_name} src={profile.avatar_url} size="lg" ring />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{profile.display_name}</h1>
          <p className="truncate text-sm text-muted">@{profile.username}{profile.timezone && ` · ${profile.timezone}`}</p>
          <p className="mt-0.5 text-xs text-muted"><Link to={`/u/${profile.username}/followers`} className="hover:underline"><b className="text-ink">{profile.followers_count}</b> followers</Link> · <Link to={`/u/${profile.username}/following`} className="hover:underline"><b className="text-ink">{profile.following_count}</b> following</Link></p>
        </div>
        {!r.is_me && <UserMenu userId={profile.id} name={profile.display_name} onBlocked={() => setProfile(null)} />}
      </div>
      {profile.bio && <p className="text-sm leading-relaxed">{profile.bio}</p>}
      <div className="ft-chips">{profile.languages.map((l) => <LanguageChip key={`${l.language_code}-${l.role}`} language={nameOf(l.language_code)} level={l.level} />)}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {r.is_me ? <Link to="/profile/edit"><Button variant="secondary" size="sm">Edit profile</Button></Link>
          : <><FollowButton userId={profile.id} initial={r.following} /><MessageButton userId={profile.id} />{r.follows_me && <span className="text-xs text-muted">Follows you</span>}</>}
      </div>
    </Card>
  );
}
