import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProfileCard } from '@/components/features';
import { Avatar, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { listFollowRequests, respondFollowRequest, searchPeople, type MiniUser } from '@/services';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { Person } from '@/types/db';

const SUGGESTION_COUNT = 5;
export default function Home() {
  const { me, languages } = useProfileStore(); const nameOf = useLanguageStore((s) => s.name);
  const [requests, setRequests] = useState<(MiniUser & { follower_id: string })[]>([]); const [people, setPeople] = useState<Person[] | null>(null);
  const target = languages.find((l) => l.role === 'learning');
  useEffect(() => {
    listFollowRequests().then(setRequests).catch(() => {});
    searchPeople(target ? { language: target.language_code, role: 'native' } : {}).then((r) => setPeople(r.slice(0, SUGGESTION_COUNT))).catch(() => setPeople([]));
  }, []);
  const answer = async (id: string, accept: boolean) => { await respondFollowRequest(id, accept); setRequests((r) => r.filter((x) => x.follower_id !== id)); };
  return (
    <>
      <PageHeader title={`Hi, ${me?.display_name ?? 'there'}`} subtitle={target ? `Native ${nameOf(target.language_code)} speakers you can practice with` : 'People you might enjoy talking with'} />
      <div className="space-y-4">
        {requests.length > 0 && (
          <Card className="space-y-3"><h2 className="font-semibold">Follow requests</h2>{requests.map((r) => (
            <div key={r.follower_id} className="flex items-center gap-3"><Avatar name={r.display_name} src={r.avatar_url} size="sm" />
              <Link to={`/u/${r.username}`} className="flex-1 truncate font-medium">{r.display_name}</Link>
              <Button size="sm" onClick={() => answer(r.follower_id, true)}>Accept</Button><Button size="sm" variant="secondary" onClick={() => answer(r.follower_id, false)}>Decline</Button></div>))}</Card>)}
        {people === null ? <div className="flex justify-center p-6"><Spinner /></div>
          : people.length ? people.map((p) => <ProfileCard key={p.id} person={p} />)
          : <EmptyState title="No matches yet" text="Browse everyone in Discover." action={<Link to="/discover"><Button>Open Discover</Button></Link>} />}
      </div>
    </>
  );
}
