import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Clock4Icon, Coins, GraduationCap, Pencil, Settings, Shield } from 'lucide-react';
import { Avatar, Button, buttonClass, Card, EmptyState, ErrorState, PostListSkeleton, ProfileSkeleton, Spinner } from '@/components/ui';
import {
  CountryBadge,
  LanguageChip,
  languageEntry,
  VouchCard,
  MessageButton,
  UserMenu,
  AccountZone,
} from '@/components/features';
import { getProfile } from '@/services';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { useCountries } from '@/store/countryStore';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { FullProfile } from '@/types/db';
import { listUserContributionPosts, type ContributionPost } from '@/services/library';
import { PostCard } from '@/components/features/library';
import { useInfiniteScroll, usePagedList } from '@/store/feedCache';
import { usePresenceOf } from '@/hooks/usePresence';
import { activityLabel } from '@/lib/format';

export default function UserProfile() {
  const { username = '' } = useParams();
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  useCountries();
  const [profile, setProfile] = useState<FullProfile | null | undefined>(
    undefined,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setProfile(undefined);
    setLoadFailed(false);
    getProfile(username)
      .then(setProfile)
      .catch(() => { setLoadFailed(true); setProfile(null); });
  }, [username, attempt]);
  const role = useProfileStore((s) => s.me?.role);
  const staff = role === 'admin' || role === 'moderator';
  const myPoints = useProfileStore((s) => s.me?.points_balance);
  const providerAvatar = useProviderAvatar();
  const seen = usePresenceOf([profile?.id])[profile?.id ?? ''];
  // Cached and paged like Home: instant when you come back, more as you scroll.
  const postList = usePagedList<ContributionPost>(profile?.id ? `posts:user:${profile.id}` : null,
    async (offset, limit) => (await listUserContributionPosts(profile!.id, { offset, limit })).posts);
  const posts = postList.initialLoading ? null : postList.items;
  const setPosts = (fn: (list: ContributionPost[] | null) => ContributionPost[] | null) => postList.update((items) => fn(items) ?? []);
  const sentinel = useInfiniteScroll(postList.loadMore, !postList.done && !postList.initialLoading, postList.items.length);


  if (profile === undefined)
    return (
      <ProfileSkeleton />
    );
  
  if (profile === null && loadFailed) return <ErrorState title="Couldn't load this profile" onRetry={() => setAttempt((a) => a + 1)} />;
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
  const r = profile.relationship;
  const shortcuts = [
    { to: '/learning', label: 'Learning', hint: 'Your phrasebook and progress', icon: GraduationCap },
    { to: '/points-history', label: 'Points', hint: myPoints !== undefined ? `${myPoints} points · history` : 'History', icon: Coins },
    { to: '/settings', label: 'Settings', hint: 'Account, privacy and appearance', icon: Settings },
    ...(staff ? [{ to: '/admin', label: 'Admin', hint: 'Reports and review', icon: Shield }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <Card pad={false} className="overflow-hidden">
        {/* Cover band: the deep brand colour with a soft coral glow */}
        <div aria-hidden className="h-20 bg-deep sm:h-24" style={{ backgroundImage: 'radial-gradient(120% 140% at 100% 0%, rgb(var(--c-accent) / 0.55), transparent 55%), radial-gradient(80% 120% at 0% 100%, rgb(var(--c-aqua) / 0.35), transparent 60%)' }} />
        <div className="ft-card-pad pt-0">
          <div className="flex items-end justify-between gap-3">
            <span className="-mt-12 rounded-full bg-surface p-1 sm:-mt-14">
              <Avatar name={profile.display_name} src={r.is_me ? resolveAvatar(profile.avatar_url, providerAvatar) : profile.avatar_url} size="xl" online={!r.is_me && !!seen?.online} />
            </span>
            <div className="flex items-center gap-1.5 pt-3">
              {r.is_me
                ? <Link to="/profile/edit" className={buttonClass('secondary', 'sm')}><Pencil size={15} aria-hidden /> Edit profile</Link>
                : <><MessageButton userId={profile.id} /><UserMenu userId={profile.id} name={profile.display_name} onBlocked={() => setProfile(null)} /></>}
            </div>
          </div>

          <h1 className="mt-3 break-words font-display text-2xl font-medium leading-tight text-ink">{profile.display_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="truncate">@{profile.username}</span>
            <CountryBadge code={profile.country_code} timezone={profile.timezone} showName />
            {profile.timezone && <span className="flex items-center gap-1 text-xs"><Clock4Icon size={13} aria-hidden /> {profile.timezone}</span>}
            {!r.is_me && seen && activityLabel(seen) && <span className="text-xs">{activityLabel(seen)}</span>}
          </div>

          {profile.bio && <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink">{profile.bio}</p>}

          {profile.languages.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Languages</p>
              <div className="ft-chips"><LanguageChip languages={profile.languages.map((l) => languageEntry(l, labelOf(l, locales)))} /></div>
            </div>
          )}
          {!r.is_me && <div className="mt-4"><VouchCard userId={profile.id} name={profile.display_name} /></div>}
        </div>
      </Card>

      {r.is_me && (
        <Card pad={false} className="divide-y divide-border overflow-hidden">
          {shortcuts.map(({ to, label, hint, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon size={18} aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{label}</span><span className="block truncate text-xs text-muted">{hint}</span></span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
      <div className="space-y-4">
        <h3 className="px-1 font-bold text-lg text-ink">Contributions</h3>
        {posts === null ? (
          <PostListSkeleton count={2} />
        ) : posts.length === 0 ? (
          <p className="px-1 text-sm text-muted italic">No contributions yet.</p>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onRemoved={(id) => setPosts((list) => list?.filter((x) => x.id !== id) ?? null)}
              onPinChange={(id, pinned) => setPosts((list) => {
                if (!list) return list;
                // One pinned post per profile: it moves to the top, any other loses its pin.
                const now = new Date().toISOString();
                const next = list.map((x) => ({ ...x, pinned_at: x.id === id ? (pinned ? now : null) : pinned ? null : x.pinned_at }));
                return [...next].sort((x, y) => (y.pinned_at ? 1 : 0) - (x.pinned_at ? 1 : 0) || y.created_at.localeCompare(x.created_at));
              })}
            />
          ))
        )}
        <div ref={sentinel} aria-hidden />
        {postList.loading && posts && <div className="flex justify-center p-4"><Spinner /></div>}
      </div>

      {r.is_me && <div className="mt-4"><AccountZone /></div>}

    </div>
  );
}
