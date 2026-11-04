import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { mixFeed, weavePosts } from '@/lib/feedMix';
import { FirstSteps, ProfileCard } from '@/components/features';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState, PostListSkeleton, Spinner,
} from '@/components/ui';
import { homeFeed } from '@/services';
import { useCountries } from '@/store/countryStore';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { FeedPerson } from '@/types/db';
import { listContributionPosts, listPostsNeedingFix, type ContributionPost } from '@/services/library';
import { DecisionBanner } from '@/components/features/review/DecisionQueue';
import { PostCard } from '@/components/features/library';
import { useFeedCache, useInfiniteScroll, usePagedList } from '@/store/feedCache';

const HELP_PREVIEW = 3;
const OTHERS_PREVIEW = 5;   // people with no shared language only fill in; the rest are in search

export default function Home() {
  const { me, languages } = useProfileStore();
  const languageName = useLanguageStore((s) => s.name);
  const providerAvatar = useProviderAvatar();
  useCountries();
  const [hidden, setHidden] = useState<string[]>([]);

  const nameOf = (id?: string | null) => (id ? languageName(id) ?? id : null);
  // Posts: cached and paged — shown instantly when coming back, next page loads on scroll.
  // Posts in my two languages come first; the key changes when those languages do.
  const feed = usePagedList(`posts:home:${me?.native_language_id ?? ''}:${me?.learning_language_id ?? ''}`, async (offset, limit) => (await listContributionPosts(undefined, undefined, { offset, limit }, true)).posts);
  // Requests for help in my languages, so they get seen among the other posts.
  const myLanguages = [me?.native_language_id, me?.learning_language_id].filter((l): l is string => !!l);
  const needingFix = usePagedList<ContributionPost>(me ? `posts:needfix:${myLanguages.join(',')}` : null, async (offset) => (offset || !me ? [] : listPostsNeedingFix(myLanguages, me.id, HELP_PREVIEW)), HELP_PREVIEW);
  const removePost = useFeedCache((s) => s.removeEverywhere);
  const sentinel = useInfiniteScroll(feed.loadMore, !feed.done && !feed.initialLoading, feed.items.length);

  // People: cached too; the key changes (and refetches) when my languages or country change.
  const peopleKey = `people:home:${languages.map((l) => `${l.language_id}.${l.role}`).sort().join(',')}:${me?.country_code ?? ''}:${me?.timezone ?? ''}`;
  const peopleList = usePagedList<FeedPerson>(peopleKey, async (offset) => (offset ? [] : homeFeed()), 10_000);

  const nativeName = nameOf(me?.native_language_id);
  const learningName = nameOf(me?.learning_language_id);
  const emptyText = learningName
    ? `Nobody matches yet. Anyone who speaks ${learningName} natively, and anyone learning ${nativeName}, will appear here as they join. They don't need to want what you offer. You can also search by name or @username.`
    : nativeName
      ? `Add a language you are learning in your profile to get matched. People learning ${nativeName} will appear here as they join, or search by name or @username.`
      : 'Search for anyone by name or @username.';

  const { partners, others } = useMemo(() => {
    const rows = peopleList.items.filter((p) => !hidden.includes(p.id));
    return {
      partners: rows.filter((p) => p.match_kind !== 'other'),
      others: rows.filter((p) => p.match_kind === 'other'),
    };
  }, [peopleList.items, hidden]);

  const posts = useMemo(() => weavePosts(feed.items, needingFix.items.filter((p) => p.review_status === 'awaiting_feedback')), [feed.items, needingFix.items]);
  const { items, morePeople } = useMemo(
    () => mixFeed(posts, [...partners, ...others.slice(0, OTHERS_PREVIEW)], feed.done || !!feed.error),
    [posts, partners, others, feed.done, feed.error],
  );

  const drop = (id: string) => setHidden((h) => [...h, id]);
  // Held until all three have answered, so a late list doesn't push down what is being read.
  const firstLoad = feed.initialLoading || peopleList.initialLoading || needingFix.initialLoading;

  return (
    <>
      <DecisionBanner />
      <FirstSteps />
      {/* Composer: looks like an input so it invites typing, but opens the contribute page */}
      <Link
        to="/library/contribute"
        aria-label="Create a post"
        className="ft-card mb-4 flex items-center gap-3 p-3 transition-colors hover:bg-surface-2"
      >
        <Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="md" />
        <span className="min-w-0 flex-1 truncate rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted">
          Write something, ask a question, share a photo…
        </span>
        <ImagePlus size={22} className="shrink-0 text-accent" aria-hidden />
      </Link>

      {firstLoad ? (
        <PostListSkeleton count={3} />
      ) : (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          {feed.error && <ErrorState title="Couldn't load posts" busy={feed.loading} onRetry={() => void feed.refresh()} />}

          {!items.length && !feed.error && (peopleList.error
            ? <ErrorState title="Couldn't load your feed" busy={peopleList.loading} onRetry={() => void peopleList.refresh()} />
            : (
              <EmptyState
                title="Nothing here yet"
                text={emptyText}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link to="/library/contribute"><Button size="sm">Write a post</Button></Link>
                    <Link to="/search"><Button size="sm" variant="secondary">Search people</Button></Link>
                  </div>
                }
              />
            ))}

          {items.map((item) => (item.kind === 'post'
            ? <PostCard key={`post:${item.post.id}`} post={item.post} onRemoved={removePost} />
            : <ProfileCard key={`person:${item.person.id}`} person={item.person} onHidden={drop} />))}

          <div ref={sentinel} aria-hidden />
          {feed.loading && <div className="flex justify-center p-4"><Spinner /></div>}
          {!partners.length && !!others.length && (
            <p className="ft-inset text-center text-sm text-muted">
              Nobody here shares one of your languages yet. <Link to="/profile/edit" className="font-semibold text-brand hover:underline">Check my languages</Link>
            </p>
          )}
          {(morePeople || others.length > OTHERS_PREVIEW) && feed.done && (
            <Link to="/search?tab=people" className="ft-inset self-center text-sm font-semibold text-brand hover:underline">
              Find more people
            </Link>
          )}
          {feed.done && !!items.length && <p className="py-4 text-center text-xs text-muted">You're all caught up.</p>}
        </div>
      )}
    </>
  );
}
