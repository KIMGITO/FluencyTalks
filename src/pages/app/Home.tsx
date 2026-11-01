import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { ProfileCard } from '@/components/features';
import {
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  Spinner,
} from '@/components/ui';
import { homeFeed, type MiniUser } from '@/services';
import { useCountries } from '@/store/countryStore';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { FeedPerson } from '@/types/db';
import { listContributionPosts, type ContributionPost } from '@/services/library';
import { PostCard } from '@/components/features/library';
import { useFeedCache, useInfiniteScroll, usePagedList } from '@/store/feedCache';

const OTHERS_PREVIEW = 5;   // the posts feed scrolls forever below, so "everyone else" is a short preview



export default function Home() {
  const { me, languages } = useProfileStore();
  const labelOf = useLanguageStore((s) => s.labelOf);
  const languageName = useLanguageStore((s) => s.name);
  const locales = useDisplayLocales();
  const providerAvatar = useProviderAvatar();
  useCountries(); 
  const [hidden, setHidden] = useState<string[]>([]);

  
  const nameOf = (id?: string | null) => (id ? languageName(id) ?? id : null);
  // Posts: cached and paged — shown instantly when coming back, next page loads on scroll.
  const feed = usePagedList('posts:home', async (offset, limit) => (await listContributionPosts(undefined, undefined, { offset, limit })).posts);
  const removePost = useFeedCache((s) => s.removeEverywhere);
  const sentinel = useInfiniteScroll(feed.loadMore, !feed.done && !feed.initialLoading, feed.items.length);

  // People: cached too; the key changes (and refetches) when my languages or country change.
  const peopleKey = `people:home:${languages.map((l) => `${l.language_id}.${l.role}`).sort().join(',')}:${me?.country_code ?? ''}:${me?.timezone ?? ''}`;
  const peopleList = usePagedList<FeedPerson>(peopleKey, async (offset) => (offset ? [] : homeFeed()), 10_000);
  const people = peopleList.initialLoading ? null : peopleList.items;

  const nativeName = nameOf(me?.native_language_id);
  const learningName = nameOf(me?.learning_language_id);
  const emptyText = learningName
    ? `Nobody matches yet. People who speak ${learningName} natively, or are learning ${nativeName}, will appear here as they join. You can also search by name or @username.`
    : nativeName
      ? `Add a language you are learning in your profile to get matched. People learning ${nativeName} will appear here as they join, or search by name or @username.`
      : 'Search for anyone by name or @username.';

  const { partners, others } = useMemo(() => {
    const rows = (people ?? []).filter((p) => !hidden.includes(p.id));
    return {
      partners: rows.filter((p) => p.match_kind !== 'other'),
      others: rows.filter((p) => p.match_kind === 'other'),
    };
  }, [people, hidden]);

  const drop = (id: string) => setHidden((h) => [...h, id]);

  return (
    <>
      {/* Composer: looks like an input so it invites typing, but opens the contribute page */}
      <Link
        to="/library/contribute"
        aria-label="Create a post"
        className="ft-card mb-4 flex items-center gap-3 p-3 transition-colors hover:bg-surface-2"
      >
        <Avatar name={me?.display_name ?? 'U'} src={resolveAvatar(me?.avatar_url, providerAvatar)} size="md" />
        <span className="min-w-0 flex-1 truncate rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted">
          Share a phrase, idiom or example…
        </span>
        <ImagePlus size={22} className="shrink-0 text-accent" aria-hidden />
      </Link>
      <div className="flex flex-col gap-2">
        {people === null ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : (
          <>
            {partners.length > 0 &&
              partners.map((p) => (
                <ProfileCard key={p.id} person={p} onHidden={drop} />
              ))}

            {partners.length === 0 && others.length === 0 && (
              <EmptyState
                title="No matches yet"
                text={emptyText}
                action={
                  <Link to="/search">
                    <Button size="sm">Search people</Button>
                  </Link>
                }
              />
            )}

            {}
            {partners.length === 0 && others.length > 0 && (
              <EmptyState
                title="No language match yet"

                text="Nobody here shares one of your languages right now. Browse posts and everyone below while more people join."
                action={
                  <Link to="/profile/edit">
                    <Button size="sm" variant="secondary">
                      My languages
                    </Button>
                  </Link>
                }
              />
            )}
          </>
        )}

        {others.length > 0 && (
          <>
            <Divider label="Everyone else" className="mt-4 mb-1" position="ne" />
            {others.slice(0, OTHERS_PREVIEW).map((p) => (
              <ProfileCard key={p.id} person={p} onHidden={drop} />
            ))}
            {others.length > OTHERS_PREVIEW && (
              <Link to="/search?tab=people" className="ft-inset self-center text-sm font-semibold text-brand hover:underline">
                Find more people
              </Link>
            )}
          </>
        )}

        {/* Community feed: newest posts, loading more as you scroll */}
        <Divider label="From the community" className="mt-4 mb-1" position="ne" />
        {feed.initialLoading ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : feed.error ? (
          <EmptyState title="Couldn't load posts" text="Check your connection and try again." action={<Button size="sm" variant="secondary" onClick={feed.refresh}>Try again</Button>} />
        ) : feed.items.length === 0 ? (
          <EmptyState
            title="No posts yet"
            text="Phrases, idioms and examples people share will show up here."
            action={
              <Link to="/library/contribute">
                <Button size="sm">Share a phrase</Button>
              </Link>
            }
          />
        ) : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            {feed.items.map((p) => (
              <PostCard key={p.id} post={p} onRemoved={removePost} />
            ))}
            <div ref={sentinel} aria-hidden />
            {feed.loading && <div className="flex justify-center p-4"><Spinner /></div>}
            {feed.done && feed.items.length > 0 && <p className="py-4 text-center text-xs text-muted">You're all caught up.</p>}
          </div>
        )}
      </div>
    </>
  );
}
