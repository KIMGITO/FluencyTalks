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

/**
 * Home is the daily scroll: people who share one of my languages, then a divider, then
 * everyone else. `home_feed()` returns both groups already split, sorted and filtered
 * (blocked, suspended and half-finished accounts never reach the client), so this page
 * only has to decide how to draw the line between the two.
 */
export default function Home() {
  const { me, languages } = useProfileStore();
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  useCountries(); // flags need the country names
  const [people, setPeople] = useState<FeedPerson[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  const learning = languages.filter((l) => l.role === 'learning');
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

            {/* The line the brief asks for: partners above, the rest of the app below. */}
            {partners.length > 0 && others.length > 0 && (
              <Divider label="Everyone else" className="my-2" position="ne" />
            )}

            {partners.length === 0 && others.length === 0 && (
              <EmptyState
                title="No matches yet"
                text={languages.length > 0
                  ? `Wait — ${languages.length} ${
                      languages.length === 1 ? 'person' : 'people'
                    } ${languages.length === 1
                      ? me.native_language_id
                      : languages
                          .filter((l) => l.role === 'native')
                          .map((l) => labelOf(l.language_code) ?? l.language_code)
                          .join(', ')} ${
                      languages.length === 1
                        ? 'speaks natively.'
                        : 'speak natively.'
                  }${languages.some((l) => l.role === 'learning')
                    ? ` ${languages.filter((l) => l.role === 'learning').length} ${
                        languages.filter((l) => l.role === 'learning').length === 1
                          ? 'person'
                          : 'people'
                      } learning ${
                          languages
                            .filter((l) => l.role === 'learning')
                            .map((l) => labelOf(l.language_code) ?? l.language_code)
                            .join(', ')
                        } ${languages.filter((l) => l.role === 'learning').length === 1
                          ? 'is learning.'
                          : 'are learning.'
                        }`
                    : '.'}`
                  : 'Search for anyone by name or @username.'}
                action={
                  <Link to="/search">
                    <Button size="sm">Search people</Button>
                  </Link>
                }
              />
            )}

            {/* Shown above the list it is talking about, and says so. */}
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
      </div>
    </>
  );
}
