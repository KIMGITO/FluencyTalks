import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteContribution, type ContributionPost } from '@/services/library';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

export interface PostCardProps {
  post: ContributionPost & {
    author?: { display_name?: string | null; username?: string; id?: string } | null;
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  phrase: 'bg-brand/10 text-brand',
  idiom: 'bg-purple-500/10 text-purple-500',
  usage: 'bg-emerald-500/10 text-emerald-600',
  grammar: 'bg-amber-500/10 text-amber-600',
};

export function PostCard({ post }: PostCardProps) {
  const [deleted, setDeleted] = useState(false);
  const me = useProfileStore((s) => s.me);
  const isOwner = me?.id === post.user_id;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteContribution(post.id);
      setDeleted(true);
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  if (deleted) return null;

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
          {/* category badge & actions */}
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[post.category] ?? 'bg-surface text-muted'}`}>
              {post.category}
            </span>
            {isOwner && (
              <button
                onClick={handleDelete}
                className="text-muted hover:text-danger transition-colors p-1"
                title="Delete post"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
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
