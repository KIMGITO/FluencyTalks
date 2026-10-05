import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProfileCard } from '@/components/features';
import { Avatar, Button, Card, Divider, EmptyState, Spinner } from '@/components/ui';
import { homeFeed, listFollowRequests, respondFollowRequest, type MiniUser } from '@/services';
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
  const { me, languages } = useProfileStore(); const labelOf = useLanguageStore((s) => s.labelOf); const locales = useDisplayLocales();
  useCountries();                              // flags need the country names
  const [requests, setRequests] = useState<(MiniUser & { follower_id: string })[]>([]);
  const [answering, setAnswering] = useState<string | null>(null); const [answerError, setAnswerError] = useState('');
  const [people, setPeople] = useState<FeedPerson[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);   // blocked from this card: drop the row

  const learning = languages.filter((l) => l.role === 'learning');
  useEffect(() => {
    listFollowRequests().then(setRequests).catch(() => {});
    homeFeed().then(setPeople).catch(() => setPeople([]));
  }, []);

  const { partners, others } = useMemo(() => {
    const rows = (people ?? []).filter((p) => !hidden.includes(p.id));
    return { partners: rows.filter((p) => p.match_kind !== 'other'), others: rows.filter((p) => p.match_kind === 'other') };
  }, [people, hidden]);

  // Follow back = accept their request AND follow them (mutual). Cancel = drop their request.
  const answer = async (id: string, accept: boolean) => {
    setAnswering(id); setAnswerError('');
    try { await respondFollowRequest(id, accept); setRequests((r) => r.filter((x) => x.follower_id !== id)); }
    catch (e) { setAnswerError((e as Error).message); } finally { setAnswering(null); }
  };
  const drop = (id: string) => setHidden((h) => [...h, id]);
  const subtitle = learning.length
    ? `Find people to practice with.`
    : 'Add the languages you are learning to get matched with the right people';

  return (
    <>
      <PageHeader title={` ${me?.display_name?.toUpperCase() ?? 'Welcome'}`} subtitle={subtitle} />
      <div className="flex flex-col gap-2">
        {requests.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="font-semibold">Follow requests</h2>
            {answerError && <p className="text-sm text-danger">{answerError}</p>}
            {requests.map((r) => (
            <div key={r.follower_id} className="flex items-center gap-2"><Avatar name={r.display_name} src={r.avatar_url} size="sm" />
              <Link to={`/u/${r.username}`} className="min-w-0 flex-1 truncate text-sm font-medium">{r.display_name}<span className="block truncate text-xs font-normal text-muted">@{r.username} wants to follow you</span></Link>
              <Button size="sm" loading={answering === r.follower_id} onClick={() => answer(r.follower_id, true)}>Follow back</Button>
              <Button size="sm" variant="secondary" disabled={answering === r.follower_id} onClick={() => answer(r.follower_id, false)}>Cancel</Button></div>))}</Card>)}

        {people === null ? <div className="flex justify-center p-6"><Spinner /></div> : (
          <>
            {partners.length > 0 && partners.map((p) => <ProfileCard key={p.id} person={p} onHidden={drop} />)}

            {/* The line the brief asks for: partners above, the rest of the app below. */}
            {partners.length > 0 && others.length > 0 && <Divider label="Everyone else" className="my-2" />}

            {partners.length === 0 && others.length === 0 && (
              <EmptyState title="No matches yet" text="Search for anyone by name or @username."
                action={<Link to="/search"><Button size="sm">Search people</Button></Link>} />
            )}

            {/* Shown above the list it is talking about, and says so. */}
            {partners.length === 0 && others.length > 0 && (
              <EmptyState title="No language match yet" text="Nobody here shares one of your languages right now — browse everyone below, or add more languages."
                action={<Link to="/profile/edit"><Button size="sm" variant="secondary">My languages</Button></Link>} />
            )}

            {others.map((p) => <ProfileCard key={p.id} person={p} onHidden={drop} />)}
          </>
        )}
      </div>
    </>
  );
}
