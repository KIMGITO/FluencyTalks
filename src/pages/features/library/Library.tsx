import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { EmptyState, ErrorState, Input, PostListSkeleton, Select, Spinner, Tabs, buttonClass } from '@/components/ui';
import { BookOpen, Plus, RefreshCw, Filter, X } from 'lucide-react';
import { listContributionPosts, listPracticePosts, listSavedPosts, isContributionEligible, type ContributionPost } from '@/services/library';
import { searchPosts } from '@/services/search';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useInfiniteScroll, usePagedList } from '@/store/feedCache';
import { displayLabel, useDisplayLocales, useLanguages } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { PostCard } from '@/components/features/library';

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'phrase', label: 'Phrases' },
  { value: 'idiom', label: 'Idioms' },
  { value: 'usage', label: 'Usage examples' },
  { value: 'grammar', label: 'Grammar' },
];

export default function Library() {
  const [params, setParams] = useSearchParams();
  // ?tab=saved opens the posts you saved; ?tab=practice the requests for help.
  const tab = params.get('tab');
  const view = tab === 'saved' || tab === 'practice' ? tab : 'all';
  const [lang, setLang] = useState('');
  const [cat, setCat] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const languages = useLanguages();
  const locales = useDisplayLocales();
  const me = useProfileStore((s) => s.me);
  const eligible = isContributionEligible(me);

  // My two languages first, then the launch list A-Z.
  const languageOptions = useMemo(() => {
    const mine = [me?.native_language_id, me?.learning_language_id];
    const label = (l: (typeof languages)[number]) => displayLabel(l, locales);
    return [
      ...mine.flatMap((id) => languages.filter((l) => l.id === id)),
      ...languages.filter((l) => l.is_supported_learning && !mine.includes(l.id)).sort((a, b) => label(a).localeCompare(label(b))),
    ].map((l) => ({ id: l.id, label: label(l) }));
  }, [languages, locales, me?.native_language_id, me?.learning_language_id]);

  // Typing searches the server (all posts, not only the loaded pages); saved posts are filtered locally.
  const q = useDebouncedValue(searchText, 300).trim();
  const serverSearch = view === 'all' && !!q;
  // Cached, paged lists: one cache entry per tab + filter combination.
  const key = view === 'saved' ? 'posts:saved' : view === 'practice' ? `posts:practice:${lang}` : serverSearch ? `posts:search:${q}:${lang}` : `posts:library:${lang}:${cat}`;
  const list = usePagedList<ContributionPost>(key, async (offset, limit) => {
    if (view === 'saved') return listSavedPosts({ offset, limit });
    if (view === 'practice') return listPracticePosts(lang || undefined, { offset, limit });
    if (serverSearch) return (await searchPosts({ query: q, language: lang || undefined, offset, limit })) as unknown as ContributionPost[];
    return (await listContributionPosts(lang || undefined, cat || undefined, { offset, limit })).posts;
  });
  const sentinel = useInfiniteScroll(list.loadMore, !list.done && !list.initialLoading, list.items.length);

  const displayed = useMemo(() => {
    const needle = q.toLowerCase();
    return list.items.filter((p) =>
      // The server already filtered "all posts" by language/category (and text when searching);
      // the saved list and the search results still need the remaining filters here.
      (view === 'practice' || !cat || p.category === cat) &&
      (view === 'all' || ((!lang || p.language_id === lang) && (!needle ||
        p.phrase.toLowerCase().includes(needle) ||
        (p.translation ?? '').toLowerCase().includes(needle) ||
        (p.source_context ?? '').toLowerCase().includes(needle)))));
  }, [list.items, q, cat, lang, view]);

  const hasFilters = lang || (view !== 'practice' && cat);

  return (
    <div className="mx-auto w-full max-w-3xl py-4 pb-24 md:p-4">
      <PageHeader
        title="Community Library"
        subtitle={view === 'practice' ? 'Stories, questions and first attempts from learners. Mistakes are welcome here.' : 'Browse phrases, idioms and lessons contributed by the community'}
      />

      <div className="ft-inset mb-3">
        <Tabs
          value={view}
          onChange={(key) => setParams(key === 'all' ? {} : { tab: key }, { replace: true })}
          items={[{ key: 'all', label: 'All posts' }, { key: 'practice', label: 'Practice' }, { key: 'saved', label: 'Saved' }]}
        />
      </div>

      <div className="ft-inset mb-4 flex flex-wrap items-center gap-2">
        {}
        <div className="relative flex-1 min-w-[180px]">
          <Input
            placeholder="Search phrases…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pr-8"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((f) => !f)}
          className={`flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition ${
            showFilters || hasFilters
              ? 'bg-brand text-on-brand'
              : 'bg-surface-2 text-muted hover:bg-border hover:text-ink'
          }`}
        >
          <Filter size={14} />
          Filters{hasFilters ? ' •' : ''}
        </button>

        <button
          type="button"
          onClick={() => void list.refresh()}
          disabled={list.loading}
          title="Refresh"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition hover:bg-border hover:text-ink disabled:opacity-40"
        >
          <RefreshCw size={15} className={list.loading ? 'animate-spin' : ''} />
        </button>

        {me && (
          <Link
            to="/library/contribute"
            className={buttonClass('primary', 'sm')}
          >
            <Plus size={15} />
            New post
          </Link>
        )}
      </div>

      {}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-y md:rounded-md md:border border-border bg-surface-2 p-3">
          <div className="min-w-[11rem] flex-1">
            <Select aria-label="Filter by language" searchable value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="">All languages</option>
              {languageOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
          </div>

          {view !== 'practice' && (
            <div className="min-w-[11rem] flex-1">
              <Select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setLang(''); setCat(''); }}
              className="flex items-center gap-1 rounded-sm bg-surface px-2.5 py-1 text-xs text-muted hover:text-danger transition"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {}
      {me && !eligible && (
        <p className="ft-inset mb-4 text-sm text-muted">
          <Link to="/profile/edit" className="font-semibold text-brand hover:underline">Add your languages</Link> to start posting. Stories, questions and “Correct me” posts are open to everyone from day one.
        </p>
      )}

      {}
      {list.initialLoading ? (
        <PostListSkeleton count={4} />
      ) : list.error ? (
        <ErrorState title="Couldn't load posts" busy={list.loading} onRetry={() => void list.refresh()} />
      ) : !displayed.length ? (
        <EmptyState
          title={searchText || hasFilters ? 'No matching posts' : view === 'saved' ? 'No saved posts' : view === 'practice' ? 'Nobody has asked yet' : 'Nothing here yet'}
          text={
            searchText || hasFilters
              ? 'Try different filters or search terms.'
              : view === 'saved'
                ? 'Use “Save post” in a post’s ⋮ menu to keep it here.'
                : view === 'practice'
                  ? 'Be the first. Write something in the language you are learning and people will help you with it.'
                : 'Be the first to share a phrase, idiom or lesson.'
          }
          action={
            me && eligible && view !== 'saved' ? (
              <Link
                to="/library/contribute"
                className={buttonClass('primary', 'lg')}
              >
                <Plus size={16} />
                New post
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2">
          {displayed.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              variant="compact"
              removeOnUnsave={view === 'saved'}
              onRemoved={(id) => list.update((items) => items.filter((x) => x.id !== id))}
            />
          ))}
          <div ref={sentinel} aria-hidden />
          {list.loading && <div className="flex justify-center p-4"><Spinner /></div>}
        </div>
      )}
    </div>
  );
}

