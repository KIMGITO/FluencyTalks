import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Input, Spinner } from '@/components/ui';
import { BookOpen, Plus, RefreshCw, Filter, X } from 'lucide-react';
import { listContributionPosts, isContributionEligible, type ContributionPost } from '@/services/library';
import { useLanguageStore } from '@/store/languageStore';
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
  const [, setParams] = useSearchParams();
  const [lang, setLang] = useState('');
  const [cat, setCat] = useState('');
  const [searchText, setSearchText] = useState('');
  const [posts, setPosts] = useState<(ContributionPost & { author?: { display_name?: string | null; username?: string; id?: string } | null })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const languageName = useLanguageStore((s) => s.name);
  const languages = useLanguageStore((s) => s.list);
  const me = useProfileStore((s) => s.me);
  const eligible = isContributionEligible(me);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listContributionPosts(lang || undefined, cat || undefined);
      setPosts(r.posts ?? null);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [lang, cat]);

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  const displayed = useMemo(() => {
    if (!posts) return [];
    const q = searchText.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      p.phrase.toLowerCase().includes(q) ||
      (p.translation ?? '').toLowerCase().includes(q) ||
      (p.source_context ?? '').toLowerCase().includes(q),
    );
  }, [posts, searchText]);

  const hasFilters = lang || cat;

  return (
    <div className="mx-auto w-full max-w-3xl p-4 pb-24 md:pb-4">
      <PageHeader
        title="Community Library"
        subtitle="Browse phrases, idioms and examples contributed by the community"
      />

      {}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition ${
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
          onClick={() => void fetchPosts()}
          disabled={loading}
          title="Refresh"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition hover:bg-border hover:text-ink disabled:opacity-40"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>

        {me && (
          <Link
            to="/library/contribute"
            className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 bg-brand text-on-brand hover:opacity-90 px-2 py-2 text-sm"
          >
            <Plus size={15} />
            Contribute
          </Link>
        )}
      </div>

      {}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 p-3">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>{languageName(l.id)}</option>
            ))}
          </select>

          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setLang(''); setCat(''); }}
              className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-muted hover:text-danger transition"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {}
      {me && !eligible && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span className="mt-0.5 text-lg">🔒</span>
          <span>
            To contribute, verify your native language or reach <strong>B1+</strong> in your learning language from your profile.
          </span>
        </div>
      )}

      {}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !displayed.length ? (
        <EmptyState
          title={searchText || hasFilters ? 'No matching posts' : 'Nothing here yet'}
          text={
            searchText || hasFilters
              ? 'Try different filters or search terms.'
              : 'Be the first to share a phrase, idiom or usage example.'
          }
          action={
            me && eligible ? (
              <Link
                to="/library/contribute"
                className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 bg-brand text-on-brand hover:opacity-90 px-3 py-3 text-lg"
              >
                <Plus size={16} />
                Contribute
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {displayed.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

