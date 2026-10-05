import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProfileCard } from '@/components/features';
import { MessageResult, PersonResult, SearchBox, SearchFilters } from '@/components/features/search';
import { Button, EmptyState, Spinner, Tabs } from '@/components/ui';
import { SEARCH_PAGE_SIZE } from '@/lib/constants';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchMessages, searchPeople, type SearchScope } from '@/services';
import { useLanguageStore, useLanguages } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { MessageHit, Person } from '@/types/db';

type Tab = 'all' | 'people' | 'messages';
const tabs: { key: Tab; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'people', label: 'People' }, { key: 'messages', label: 'Messages' }];
const PREVIEW = 5;                                   // rows the mixed "All" tab shows before its "See all" links

/**
 * The one place the app searches from: one box, Facebook-style tabs, filters, and all of
 * it in the URL so a search can be shared or reached with Back. `q` is mirrored into the
 * URL as you type (replaced, never pushed) and the query runs 300 ms later, so history
 * stays meaningful and the server is not hammered on every keystroke.
 */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const me = useProfileStore((s) => s.me); const myLanguages = useProfileStore((s) => s.languages);
  const languages = useLanguages(); const labelOf = useLanguageStore((s) => s.labelOf);

  const query = params.get('q') ?? '';
  const tab = (tabs.find((t) => t.key === params.get('tab'))?.key ?? 'all') as Tab;
  const language = params.get('lang') ?? ''; const role = params.get('role') ?? ''; const level = params.get('level') ?? '';
  const scope: SearchScope = params.get('scope') === 'following' ? 'following' : 'everyone';
  const filtered = !!(language || role || level) || scope === 'following';

  const patch = useCallback((p: Record<string, string>) => setParams((cur) => {
    const next = new URLSearchParams(cur);
    for (const [k, v] of Object.entries(p)) { if (v) next.set(k, v); else next.delete(k); }
    return next;
  }, { replace: true }), [setParams]);

  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);                     // the box follows the URL (Back button, shared links)
  const typed = useDebouncedValue(query, 300).trim();
  const handle = typed.replace(/^@/, '').toLowerCase();
  const wantPeople = tab !== 'messages' && (!!typed || filtered);
  const wantHits = tab !== 'people' && !!typed;

  const [people, setPeople] = useState<Person[]>([]); const [pBusy, setPBusy] = useState(false); const [pMore, setPMore] = useState(false); const [pErr, setPErr] = useState('');
  const [hits, setHits] = useState<MessageHit[]>([]); const [hBusy, setHBusy] = useState(false); const [hMore, setHMore] = useState(false); const [hErr, setHErr] = useState('');

  const peopleArgs = useMemo(() => ({ query: typed || undefined, language: language || undefined, role: role || undefined, level: level || undefined, scope, limit: tab === 'all' ? PREVIEW : SEARCH_PAGE_SIZE }), [typed, language, role, level, scope, tab]);

  useEffect(() => {
    if (!wantPeople) { setPeople([]); setPMore(false); return; }
    let live = true;
    setPBusy(true); setPErr('');
    searchPeople(peopleArgs)
      .then((rows) => { if (live) { setPeople(rows); setPMore(tab !== 'all' && rows.length === SEARCH_PAGE_SIZE); } })
      .catch((e) => { if (live) { setPeople([]); setPErr((e as Error).message); } })
      .finally(() => { if (live) setPBusy(false); });
    return () => { live = false; };
  }, [peopleArgs, tab, wantPeople]);

  useEffect(() => {
    if (!wantHits) { setHits([]); setHMore(false); return; }
    let live = true;
    setHBusy(true); setHErr('');
    searchMessages({ query: typed, limit: tab === 'all' ? PREVIEW : SEARCH_PAGE_SIZE })
      .then((rows) => { if (live) { setHits(rows); setHMore(tab !== 'all' && rows.length === SEARCH_PAGE_SIZE); } })
      .catch((e) => { if (live) { setHits([]); setHErr((e as Error).message); } })
      .finally(() => { if (live) setHBusy(false); });
    return () => { live = false; };
  }, [typed, tab, wantHits]);

  const loadMorePeople = async () => {
    setPBusy(true);
    try { const rows = await searchPeople({ ...peopleArgs, offset: people.length }); setPeople((p) => [...p, ...rows]); setPMore(rows.length === SEARCH_PAGE_SIZE); }
    catch (e) { setPErr((e as Error).message); } finally { setPBusy(false); }
  };
  const loadMoreHits = async () => {
    setHBusy(true);
    try { const rows = await searchMessages({ query: typed, offset: hits.length }); setHits((h) => [...h, ...rows]); setHMore(rows.length === SEARCH_PAGE_SIZE); }
    catch (e) { setHErr((e as Error).message); } finally { setHBusy(false); }
  };

  const hide = (id: string) => setPeople((p) => p.filter((x) => x.id !== id));
  const exact = handle && people[0]?.username?.toLowerCase() === handle ? people[0] : null;      // the "@name" someone typed
  const isMe = !!me?.username && !!handle && handle === me.username.toLowerCase();
  const quick = useMemo(() => {                                                       // shortcuts for an empty box
    const mine = myLanguages.filter((l) => l.role === 'learning').map((l) => l.language_id);
    return (mine.length ? mine : languages.slice(0, 6).map((l) => l.id)).slice(0, 6);
  }, [myLanguages, languages]);

  const personRows = <div className="flex flex-col gap-2">
    {exact && <PersonResult person={exact} />}
    {people.filter((p) => p.id !== exact?.id).map((p) => <ProfileCard key={p.id} person={p} onHidden={hide} />)}
  </div>;
  const hitRows = <div className="flex flex-col gap-2">{hits.map((h) => <MessageResult key={h.message_id} hit={h} query={typed} />)}</div>;

  const section = (title: string, target: Tab, rows: ReactNode) => (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={() => patch({ tab: target })} className="shrink-0 text-sm font-semibold text-brand hover:underline">See all</button>
      </div>
      {rows}
    </section>
  );

  const idle = !wantPeople && !wantHits;                          // nothing typed and no filters: shortcuts, not an empty list
  const loading = (wantPeople && pBusy) || (wantHits && hBusy);

  return (
    <>
      <PageHeader title="Search" subtitle="Find people to talk to, or something you said" />
      <div className="mb-3"><SearchBox value={text} onChange={(v) => patch({ q: v })} /></div>
      <div className="mb-3"><Tabs value={tab} onChange={(key) => patch({ tab: key })} items={tabs} /></div>
      {tab !== 'messages' && (
        <SearchFilters value={{ language, role, level, scope }} onChange={(p) => patch({ lang: p.language ?? '', role: p.role ?? '', level: p.level ?? '', scope: p.scope === 'following' ? 'following' : '' })} />
      )}

      {idle ? (
        <EmptyState title="Search FluencyTalks" text="Find anyone by name or @username, even people you don't follow — or look back through your chats." action={
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">{quick.map((c) => (
            <Button key={c} size="sm" variant="secondary" onClick={() => patch({ tab: 'people', lang: c, role: 'native' })}>{labelOf({ language_id: c })} speakers</Button>
          ))}</div>
        } />
      ) : (
        <>
          {pErr && <p className="mb-3 text-danger">{pErr}</p>}
          {hErr && <p className="mb-3 text-danger">{hErr}</p>}

          {tab === 'all' && loading && !people.length && !hits.length && <div className="flex justify-center p-6"><Spinner /></div>}
          {wantPeople && tab === 'all' && people.length > 0 && section('People', 'people', personRows)}
          {wantPeople && tab === 'people' && (
            <>
              {people.length > 0 ? personRows : !pBusy && !pErr && (
                isMe
                  ? <EmptyState title="That's you" text={`@${me?.username} is your own profile.`} action={<Link to="/profile"><Button size="sm">Your profile</Button></Link>} />
                  : <EmptyState title="No one matches" text={filtered ? 'Try removing a filter or searching a different language.' : `Nobody matches “${typed}” — try part of their name or @username.`} />
              )}
              {pBusy && <div className="flex justify-center p-6"><Spinner /></div>}
              {pMore && <div className="mt-4 flex justify-center"><Button variant="secondary" loading={pBusy} onClick={loadMorePeople}>Show more</Button></div>}
            </>
          )}

          {wantHits && tab === 'all' && hits.length > 0 && section('Messages', 'messages', hitRows)}
          {wantHits && tab === 'messages' && (
            <>
              {hits.length > 0 ? hitRows : !hBusy && !hErr && <EmptyState title="No messages match" text={`Nothing in your chats contains “${typed}”.`} />}
              {hBusy && <div className="flex justify-center p-6"><Spinner /></div>}
              {hMore && <div className="mt-4 flex justify-center"><Button variant="secondary" loading={hBusy} onClick={loadMoreHits}>Show more</Button></div>}
            </>
          )}

          {tab === 'all' && !loading && !people.length && !hits.length && !pErr && !hErr && (
            <EmptyState title="No results" text={typed ? `Nothing here matches “${typed}”. Try fewer letters, or drop a filter.` : 'Nobody matches these filters. Try removing one.'} />
          )}
        </>
      )}
    </>
  );
}