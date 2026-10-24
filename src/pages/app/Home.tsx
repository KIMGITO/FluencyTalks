import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
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



export default function Home() {
  const { me, languages } = useProfileStore();
  const labelOf = useLanguageStore((s) => s.labelOf);
  const languageName = useLanguageStore((s) => s.name);
  const locales = useDisplayLocales();
  useCountries(); 
  const [people, setPeople] = useState<FeedPerson[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  const learning = languages.filter((l) => l.role === 'learning');
  
  const nameOf = (id?: string | null) => (id ? languageName(id) ?? id : null);
  const [posts, setPosts] = useState<(ContributionPost & { author?: { display_name?: string | null; username?: string; id?: string } | null })[] | null>(null);

  useEffect(() => {
    listContributionPosts()
      .then((r) => setPosts(r.posts))
      .catch(() => setPosts([]));
  }, []);

  const nativeName = nameOf(me?.native_language_id);
  const learningName = nameOf(me?.learning_language_id);
  const emptyText = learningName
    ? `Nobody matches yet. People who speak ${learningName} natively, or are learning ${nativeName}, will appear here as they join. You can also search by name or @username.`
    : nativeName
      ? `Add a language you are learning in your profile to get matched. People learning ${nativeName} will appear here as they join, or search by name or @username.`
      : 'Search for anyone by name or @username.';
  useEffect(() => {
    homeFeed()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [languages, me?.country_code, me?.timezone]);

  const { partners, others } = useMemo(() => {
    const rows = (people ?? []).filter((p) => !hidden.includes(p.id));
    return {
      partners: rows.filter((p) => p.match_kind !== 'other'),
      others: rows.filter((p) => p.match_kind === 'other'),
    };
  }, [people, hidden]);

  const drop = (id: string) => setHidden((h) => [...h, id]);
  const subtitle = learning.length
    ? `Find people to practice with.`
    : 'Add the languages you are learning to get matched with the right people';

  return (
    <>
      <PageHeader
        title={` ${me?.display_name?.toUpperCase() ?? 'Welcome'}`}
        subtitle={subtitle}
      />
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

            {}
            {partners.length > 0 && others.length > 0 && (
              <Divider label="Everyone else" className="my-2" position="ne" />
            )}

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

                text="Nobody here shares one of your languages right now — browse everyone below, or add more languages."
                action={
                  <Link to="/profile/edit">
                    <Button size="sm" variant="secondary">
                      My languages
                    </Button>
                  </Link>
                }
              />
            )}

            {others.map((p) => (
              <ProfileCard key={p.id} person={p} onHidden={drop} />
            ))}
          </>
        )}
            {posts && posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}

      </div>
    </>
  );
}
