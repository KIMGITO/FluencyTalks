import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, Chip, EmptyState, ErrorState, Input, RowListSkeleton, Spinner, Tabs } from '@/components/ui';
import { CallPersonButton, ConnectButton, PersonCard, PresenceLine } from '@/components/features/people/PeopleParts';
import { searchPeople } from '@/services/search';
import { listConnectionRequests, listConnections, type PersonLite } from '@/services/connections';
import { usePersonStatus } from '@/hooks/usePersonStatus';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { Person } from '@/types/db';

type Tab = 'discover' | 'requests' | 'partners';
const PAGE = 20;

/** Find anyone, not only matches: search, filter by language, add partners; and your partners. */
export default function People() {
  const [params, setParams] = useSearchParams();
  // 'connected' is the old name of the Partners tab; old links still land there.
  const asked = params.get('tab') === 'connected' ? 'partners' : params.get('tab') ?? '';
  const tab = (['discover', 'requests', 'partners'].includes(asked) ? asked : 'discover') as Tab;
  const [requests, setRequests] = useState<(PersonLite & { created_at: string })[] | null>(null);
  useEffect(() => { listConnectionRequests().then(setRequests).catch(() => setRequests([])); }, [tab]);
  return (
    <>
      <PageHeader title="People" />
      <Tabs<Tab> value={tab} onChange={(t) => setParams(t === 'discover' ? {} : { tab: t }, { replace: true })}
        items={[{ key: 'discover', label: 'Discover' }, { key: 'requests', label: requests?.length ? `Requests (${requests.length})` : 'Requests' }, { key: 'partners', label: 'Partners' }]} />
      <div className="mt-4">
        {tab === 'discover' && <Discover initialLanguage={params.get('lang')} />}
        {tab === 'requests' && <Requests list={requests} onDone={(id) => setRequests((r) => r?.filter((x) => x.id !== id) ?? null)} />}
        {tab === 'partners' && <Partners />}
      </div>
    </>
  );
}

function Discover({ initialLanguage }: { initialLanguage: string | null }) {
  const me = useProfileStore((s) => s.me);
  const languageName = useLanguageStore((s) => s.name);
  const [query, setQuery] = useState(''); const [typed, setTyped] = useState('');
  const [language, setLanguage] = useState<string | null>(initialLanguage);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  const [more, setMore] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const { status, patch } = usePersonStatus(people?.map((p) => p.id) ?? []);
  useEffect(() => { const t = setTimeout(() => setQuery(typed), 300); return () => clearTimeout(t); }, [typed]);
  useEffect(() => {
    let live = true; setPeople(null); setFailed(false);
    searchPeople({ query, language: language ?? undefined, limit: PAGE }).then((r) => { if (live) { setPeople(r); setMore(r.length === PAGE); } }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [query, language, attempt]);
  const loadMore = async () => {
    setLoadingMore(true);
    try { const r = await searchPeople({ query, language: language ?? undefined, limit: PAGE, offset: people?.length ?? 0 }); setPeople((p) => [...(p ?? []), ...r]); setMore(r.length === PAGE); }
    catch { setMore(false); } finally { setLoadingMore(false); }
  };
  // Online people first, then the rest in the server's order.
  const sorted = useMemo(() => [...(people ?? [])].sort((a, b) => Number(!!status[b.id]?.online) - Number(!!status[a.id]?.online)), [people, status]);
  const mine = [...new Set([me?.learning_language_id, me?.native_language_id, initialLanguage].filter((l): l is string => !!l))];

  return (
    <div className="flex flex-col gap-3">
      <form noValidate onSubmit={(e) => { e.preventDefault(); setQuery(typed); }} className="relative">
        <SearchIcon size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
        <Input aria-label="Search people" placeholder="Search by name or @username" value={typed} maxLength={60} onChange={(e) => setTyped(e.target.value)} className="pl-10" enterKeyHint="search" />
      </form>
      <div className="ft-chips" role="group" aria-label="Language">
        <Chip active={!language} onClick={() => setLanguage(null)}>Everyone</Chip>
        {mine.map((l) => <Chip key={l} active={language === l} onClick={() => setLanguage(l)}>{languageName(l) ?? l}</Chip>)}
      </div>
      {failed ? <ErrorState title="Couldn't load people" onRetry={() => setAttempt((a) => a + 1)} />
        : !people ? <RowListSkeleton label="Loading people" />
          : !people.length ? <EmptyState title="No one found" />
            : <>
                {sorted.map((p) => <PersonCard key={p.id} person={p} status={status[p.id]} onChange={patch} />)}
                {more && <Button variant="secondary" className="self-center" loading={loadingMore} onClick={() => void loadMore()}>Show more people</Button>}
              </>}
    </div>
  );
}

function Requests({ list, onDone }: { list: (PersonLite & { created_at: string })[] | null; onDone: (id: string) => void }) {
  const { status, patch } = usePersonStatus(list?.map((p) => p.id) ?? []);
  if (!list) return <RowListSkeleton label="Loading requests" />;
  if (!list.length) return <EmptyState title="No requests" />;
  return (
    <ul className="flex flex-col gap-2">
      {list.map((p) => {
        const name = p.display_name ?? p.username ?? 'Someone';
        return (
          <li key={p.id} className="ft-card flex items-center gap-3 p-3">
            <Link to={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={name} src={p.avatar_url} size="md" online={!!status[p.id]?.online} />
              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{name}</span><span className="block text-xs text-muted">wants to be your partner · {new Date(p.created_at).toLocaleDateString()}</span></span>
            </Link>
            <ConnectButton compact userId={p.id} name={name} status={status[p.id]} onChange={(id, s) => { patch(id, s); if (s.connection !== 'incoming') onDone(id); }} />
          </li>);
      })}
    </ul>
  );
}

function Partners() {
  const [list, setList] = useState<(PersonLite & { accepted_at: string })[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => { setFailed(false); listConnections().then(setList).catch(() => setFailed(true)); };
  useEffect(load, []);
  const { status } = usePersonStatus(list?.map((p) => p.id) ?? []);
  if (failed) return <ErrorState title="Couldn't load your partners" onRetry={load} />;
  if (!list) return <RowListSkeleton label="Loading partners" />;
  if (!list.length) return <EmptyState title="No partners yet" />;
  // Who's around first: online, then on a call, then everyone else.
  const rank = (id: string) => (status[id]?.online && !status[id]?.in_call ? 0 : status[id]?.in_call ? 1 : 2);
  return (
    <ul className="flex flex-col gap-2">
      {[...list].sort((a, b) => rank(a.id) - rank(b.id)).map((p) => {
        const name = p.display_name ?? p.username ?? 'Someone';
        return (
          <li key={p.id} className="ft-card flex items-center gap-3 p-3">
            <Link to={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={name} src={p.avatar_url} size="md" online={!!status[p.id]?.online} />
              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{name}</span><PresenceLine status={status[p.id]} /></span>
            </Link>
            {status[p.id] ? <CallPersonButton compact person={p} status={status[p.id]} /> : <Spinner />}
          </li>);
      })}
    </ul>
  );
}
