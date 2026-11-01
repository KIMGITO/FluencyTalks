import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookMarked, MessageCircle, Newspaper, Users, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { ProfileCard } from '@/components/features';
import { PostCard } from '@/components/features/library';
import { MessageResult, PersonResult, SearchBox, SearchFilters } from '@/components/features/search';
import { Button, EmptyState, Spinner, Tabs } from '@/components/ui';
import { SEARCH_PAGE_SIZE } from '@/lib/constants';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchMessages, searchPeople, searchPhrases, searchPosts, type PhraseHit, type PostHit } from '@/services';
import { BRAND } from '@/lib/site';
import { useDisplayLocales, useLanguageStore, useLanguages } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { MessageHit, Person } from '@/types/db';

type Tab = 'all' | 'people' | 'posts' | 'messages' | 'phrases';
const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'people', label: 'People' }, { key: 'posts', label: 'Posts' },
  { key: 'messages', label: 'Messages' }, { key: 'phrases', label: 'My phrases' },
];
const PREVIEW = 4;   // rows per group on the All tab

/** One result group: fetches when `enabled`, previews on All, pages with "Show more" on its own tab. */
function useResults<T>(enabled: boolean, preview: boolean, fetch: (limit: number, offset: number) => Promise<T[]>, deps: unknown[]) {
  const [rows, setRows] = useState<T[]>([]); const [busy, setBusy] = useState(false); const [more, setMore] = useState(false); const [err, setErr] = useState('');
  const limit = preview ? PREVIEW + 1 : SEARCH_PAGE_SIZE;   // one extra on All tells us whether "See all" has more
  useEffect(() => {
    if (!enabled) { setRows([]); setMore(false); setErr(''); return; }
    let live = true;
    setBusy(true); setErr('');
    fetch(limit, 0)
      .then((r) => { if (live) { setRows(r); setMore(preview ? r.length > PREVIEW : r.length === SEARCH_PAGE_SIZE); } })
      .catch((e) => { if (live) { setRows([]); setErr((e as Error).message); } })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, preview, ...deps]);
  const loadMore = async () => {
    setBusy(true);
    try { const r = await fetch(SEARCH_PAGE_SIZE, rows.length); setRows((x) => [...x, ...r]); setMore(r.length === SEARCH_PAGE_SIZE); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return { rows: preview ? rows.slice(0, PREVIEW) : rows, all: rows, busy, more, err, loadMore, setRows };
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const me = useProfileStore((s) => s.me); const myLanguages = useProfileStore((s) => s.languages);
  const languages = useLanguages(); const labelOf = useLanguageStore((s) => s.labelOf); const languageName = useLanguageStore((s) => s.name);
  const locales = useDisplayLocales();

  const query = params.get('q') ?? '';
  const tab = (tabs.find((t) => t.key === params.get('tab'))?.key ?? 'all') as Tab;
  const language = params.get('lang') ?? ''; const role = params.get('role') ?? ''; const level = params.get('level') ?? '';
  const filtered = !!(language || role || level);

  const patch = useCallback((p: Record<string, string>) => setParams((cur) => {
    const next = new URLSearchParams(cur);
    for (const [k, v] of Object.entries(p)) { if (v) next.set(k, v); else next.delete(k); }
    return next;
  }, { replace: true }), [setParams]);

  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  const typed = useDebouncedValue(query, 300).trim();
  const handle = typed.replace(/^@/, '').toLowerCase();
  const on = (t: Tab) => tab === 'all' || tab === t;
  const preview = tab === 'all';

  // Blocks and inactive accounts are filtered by every search function on the server.
  const people = useResults<Person>(on('people') && (!!typed || filtered), preview,
    (limit, offset) => searchPeople({ query: typed || undefined, language: language || undefined, role: role || undefined, level: level || undefined, limit, offset }),
    [typed, language, role, level]);
  const posts = useResults<PostHit>(on('posts') && (!!typed || !!language), preview,
    (limit, offset) => searchPosts({ query: typed || undefined, language: language || undefined, limit, offset }), [typed, language]);
  const hits = useResults<MessageHit>(on('messages') && !!typed, preview,
    (limit, offset) => searchMessages({ query: typed, limit, offset }), [typed]);
  const phrases = useResults<PhraseHit>(on('phrases') && !!typed, preview,
    (limit, offset) => searchPhrases({ query: typed, language: language || undefined, limit, offset }), [typed, language]);

  const groups = [people, posts, hits, phrases];
  const busy = groups.some((g) => g.busy);
  const errors = [...new Set(groups.map((g) => g.err).filter(Boolean))];
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const idle = !typed && !filtered;

  const hidePerson = (id: string) => people.setRows((p) => p.filter((x) => x.id !== id));
  const dropPost = (id: string) => posts.setRows((p) => p.filter((x) => x.id !== id));
  const exact = handle && people.rows[0]?.username?.toLowerCase() === handle ? people.rows[0] : null;
  const isMe = !!me?.username && !!handle && handle === me.username.toLowerCase();
  const quick = useMemo(() => {
    const mine = myLanguages.filter((l) => l.role === 'learning').map((l) => l.language_id);
    return (mine.length ? mine : languages.slice(0, 6).map((l) => l.id)).slice(0, 6);
  }, [myLanguages, languages]);

  // ---------- Rows ----------
  const personRows = (
    <div className="flex flex-col gap-2">
      {preview
        ? people.rows.map((p) => <PersonResult key={p.id} person={p} />)
        : <>
            {exact && <PersonResult person={exact} />}
            {people.rows.filter((p) => p.id !== exact?.id).map((p) => <ProfileCard key={p.id} person={p} onHidden={hidePerson} />)}
          </>}
    </div>
  );
  const postRows = (
    <div className="flex flex-col gap-2">
      {posts.rows.map((p) => <PostCard key={p.id} post={p} variant="compact" onRemoved={dropPost} />)}
    </div>
  );
  const hitRows = <div className="flex flex-col gap-2">{hits.rows.map((h) => <MessageResult key={h.message_id} hit={h} query={typed} />)}</div>;
  const phraseRows = (
    <ul className="ft-card divide-y divide-border">
      {phrases.rows.map((p) => (
        <li key={p.id}>
          <Link to="/learning" className="flex items-start gap-3 p-3 transition-colors hover:bg-surface-2">
            <BookMarked size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{p.phrase}</span>
              {p.translation && <span className="block truncate text-xs text-muted">{p.translation}</span>}
            </span>
            {p.language_id && <span className="shrink-0 text-2xs font-semibold text-muted">{languageName(p.language_id) ?? p.language_id}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );

  // ---------- A labelled group: icon, name, count, See all (All tab) ----------
  const group = (key: Tab, title: string, Icon: LucideIcon, g: { rows: unknown[]; more: boolean }, rows: ReactNode) =>
    g.rows.length > 0 && (
      <section key={key} className="mb-5" aria-label={title}>
        <div className="ft-inset mb-2 flex items-center gap-2">
          <Icon size={16} className="text-accent" aria-hidden />
          <h2 className="font-semibold">{title}</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-bold text-muted">{g.rows.length}{g.more ? '+' : ''}</span>
          {g.more && (
            <button type="button" onClick={() => patch({ tab: key })} className="ml-auto shrink-0 text-sm font-semibold text-brand hover:underline">See all</button>
          )}
        </div>
        {rows}
      </section>
    );

  const single = (g: ReturnType<typeof useResults<any>>, rows: ReactNode, empty: ReactNode) => (
    <>
      {g.rows.length > 0 ? rows : !g.busy && !g.err && empty}
      {g.busy && <div className="flex justify-center p-6"><Spinner /></div>}
      {g.more && !g.busy && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={g.loadMore}>Show more</Button></div>}
    </>
  );

  const needsText = (what: string) => <EmptyState title={`Type to search ${what}`} text="Enter a word, a name or an @username above." />;

  return (
    <>
      <PageHeader title="Search" subtitle="People, posts, your chats and your phrasebook" />
      <div className="ft-inset mb-2"><SearchBox value={text} onChange={(v) => patch({ q: v })} /></div>
      <div className="sticky top-[var(--layout-topbarH)] z-10 mb-2 flex items-center gap-2 bg-bg/95 px-3 py-1.5 backdrop-blur md:-mx-1 md:px-1">
        <div className="min-w-0 flex-1 overflow-x-auto"><Tabs value={tab} onChange={(key) => patch({ tab: key })} items={tabs} /></div>
        {tab !== 'messages' && (
          <SearchFilters value={{ language, role, level }} onChange={(p) => patch({ lang: p.language ?? '', role: p.role ?? '', level: p.level ?? '' })} />
        )}
      </div>

      {errors.map((e) => <p key={e} className="ft-inset mb-3 text-danger">{e}</p>)}

      {idle && tab === 'all' ? (
        <EmptyState title={`Search ${BRAND}`} text="Find people, library posts, something said in your chats, or a phrase you saved." action={
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">{quick.map((c) => (
            <Button key={c} size="sm" variant="secondary" onClick={() => patch({ tab: 'people', lang: c, role: 'native' })}>{labelOf({ language_id: c }, locales)} speakers</Button>
          ))}</div>
        } />
      ) : tab === 'all' ? (
        <>
          {busy && !total && <div className="flex justify-center p-6"><Spinner /></div>}
          {group('people', 'People', Users, people, personRows)}
          {group('posts', 'Posts', Newspaper, posts, postRows)}
          {group('messages', 'Messages', MessageCircle, hits, hitRows)}
          {group('phrases', 'My phrases', BookMarked, phrases, phraseRows)}
          {!busy && !total && !errors.length && (
            <EmptyState title="No results" text={typed ? `Nothing matches “${typed}”. Try fewer letters, or drop a filter.` : 'Nothing matches these filters. Try removing one.'} />
          )}
        </>
      ) : tab === 'people' ? (
        idle ? needsText('people') : single(people, personRows, isMe
          ? <EmptyState title="That's you" text={`@${me?.username} is your own profile.`} action={<Link to="/profile"><Button size="sm">Your profile</Button></Link>} />
          : <EmptyState title="No one matches" text={filtered ? 'Try removing a filter or searching a different language.' : `Nobody matches “${typed}”. Try part of their name or @username.`} />)
      ) : tab === 'posts' ? (
        !typed && !language ? needsText('posts') : single(posts, postRows,
          <EmptyState title="No posts match" text={typed ? `No library post mentions “${typed}”.` : 'No posts in this language yet.'} action={<Link to="/library"><Button size="sm" variant="secondary">Browse the library</Button></Link>} />)
      ) : tab === 'messages' ? (
        !typed ? needsText('your messages') : single(hits, hitRows, <EmptyState title="No messages match" text={`Nothing in your chats contains “${typed}”.`} />)
      ) : (
        !typed ? needsText('your phrasebook') : single(phrases, phraseRows,
          <EmptyState title="No saved phrases match" text={`None of your saved phrases contain “${typed}”.`} action={<Link to="/learning"><Button size="sm" variant="secondary">Open Learning</Button></Link>} />)
      )}
    </>
  );
}
