import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Input, Spinner } from '@/components/ui';
import { BookOpen, Plus, RefreshCw, Filter, X } from 'lucide-react';
import { listContributionPosts, isContributionEligible, type ContributionPost } from '@/services/library';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { ContributionModal } from '@/components/features/library';

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
  const [modalOpen, setModalOpen] = useState(false);
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

      {/* ---- Top bar ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* search */}
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
          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5"
          >
            <Plus size={15} />
            Contribute
          </Button>
        )}
      </div>

      {/* ---- Filters row ---- */}
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

      {/* ---- Eligibility banner ---- */}
      {me && !eligible && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span className="mt-0.5 text-lg">🔒</span>
          <span>
            To contribute, verify your native language or reach <strong>B1+</strong> in your learning language from your profile.
          </span>
        </div>
      )}

      {/* ---- Post list ---- */}
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
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={16} />
                Contribute
              </Button>
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

      {/* ---- Modal ---- */}
      <ContributionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPosted={() => void fetchPosts()}
      />
    </div>
  );
}

/* ============================================================
   PostCard
   ============================================================ */
interface PostCardProps {
  post: ContributionPost & {
    author?: { display_name?: string | null; username?: string; id?: string } | null;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  phrase: 'bg-brand/10 text-brand',
  idiom: 'bg-purple-500/10 text-purple-500',
  usage: 'bg-emerald-500/10 text-emerald-600',
  grammar: 'bg-amber-500/10 text-amber-600',
};

function PostCard({ post }: PostCardProps) {
  const languageName = useLanguageStore((s) => s.name);
  const authorName = post.author?.display_name || post.author?.username || 'Anonymous';
  const initials = authorName.slice(0, 2).toUpperCase();

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm transition hover:shadow-md">
      {/* cover image */}
      {post.unsplash_image_url && (
        <div className="relative h-40 w-full overflow-hidden bg-surface">
          <img
            src={post.unsplash_image_url}
            alt={post.phrase}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
        </div>
      )}

      <div className="p-4 space-y-2">
        {/* header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-snug text-ink">{post.phrase}</h3>
            {post.translation && (
              <p className="mt-0.5 text-sm text-muted">{post.translation}</p>
            )}
          </div>
          {/* category badge */}
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[post.category] ?? 'bg-surface text-muted'}`}>
            {post.category}
          </span>
        </div>

        {/* source context */}
        {post.source_context && (
          <p className="rounded-lg bg-surface px-3 py-2 text-xs italic text-muted">
            "{post.source_context}"
          </p>
        )}

        {/* footer: lang + author */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {post.language_id && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">
                {post.language_id.toUpperCase()}
                {post.language_id && ` · ${languageName(post.language_id)}`}
              </span>
            )}
          </div>
          {/* author */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-[9px] font-bold text-brand">
              {initials}
            </span>
            <span>{authorName}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
