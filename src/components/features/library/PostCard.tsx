import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, Quote, Trash2 } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { UserMenu } from '@/components/features/UserMenu';
import { deleteContribution, type ContributionPost } from '@/services/library';
import { timeAgo } from '@/lib/format';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

export interface PostCardProps {
  post: ContributionPost & {
    author?: { display_name?: string | null; username?: string; id?: string; avatar_url?: string | null } | null;
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  phrase: 'border border-ink/30 bg-brand-soft text-ink',
  idiom: 'border border-ink/30 bg-surface-2 text-ink',
  usage: 'border border-ink/30 bg-surface text-ink',
  grammar: 'border border-ink/30 bg-surface-2 text-ink',
};

const CATEGORY_LABELS: Record<string, string> = {
  phrase: 'Phrase',
  idiom: 'Idiom',
  usage: 'Usage',
  grammar: 'Grammar',
};

export function PostCard({ post }: PostCardProps) {
  const [deleted, setDeleted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const me = useProfileStore((s) => s.me);
  const languageName = useLanguageStore((s) => s.name);
  const isOwner = me?.id === post.user_id;

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteContribution(post.id);
      setDeleted(true);
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  if (deleted) return null;

  const authorName = post.author?.display_name || post.author?.username || 'Anonymous';
  const username = post.author?.username;
  const language = post.language_id ? languageName(post.language_id) ?? post.language_id : null;
  const category = CATEGORY_LABELS[post.category] ?? post.category;

  const profileLink = (children: React.ReactNode, className?: string) =>
    username ? <Link to={`/u/${username}`} className={className}>{children}</Link> : <span className={className}>{children}</span>;

  return (
    <article className="ft-card overflow-hidden p-3 md:p-4">
      {/* Author row */}
      <header className="flex items-center gap-3 px-1">
        {profileLink(
          <span className="block rounded-full border-2 border-accent p-0.5">
            <Avatar name={authorName} src={post.author?.avatar_url} size="md" />
          </span>,
          'shrink-0',
        )}
        <div className="min-w-0 flex-1">
          {profileLink(authorName, 'block truncate font-semibold text-ink hover:underline')}
          <p className="truncate text-xs text-muted">
            {timeAgo(post.created_at)}
            {language && ` · ${language}`}
          </p>
        </div>
        {isOwner ? (
          <div className="relative">
            <Button variant="ghost" size="sm" aria-label="Post options" onClick={() => setMenuOpen((o) => !o)}>
              <MoreVertical size={16} />
            </Button>
            {menuOpen && (
              <div className="ft-menu right-0 mt-1.5">
                <button className="ft-menu-item text-danger hover:bg-danger/10" onClick={handleDelete}>
                  <Trash2 size={14} /> Delete post
                </button>
              </div>
            )}
          </div>
        ) : (
          post.author?.id && <UserMenu userId={post.author.id} name={authorName} onBlocked={() => setDeleted(true)} />
        )}
      </header>

      {/* Media: the post's image, or the phrase itself on a tinted panel when there is none */}
      <div className="relative mt-3 overflow-hidden rounded-xl bg-brand-soft">
        {post.unsplash_image_url ? (
          <>
            <img
              src={post.unsplash_image_url}
              alt={post.phrase}
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
          </>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center p-6 text-center">
            <p className="text-2xl font-bold leading-snug text-ink md:text-3xl">{post.phrase}</p>
          </div>
        )}

        <span className="absolute right-3 top-3 rounded-full bg-ink/60 px-2.5 py-0.5 text-xs font-semibold text-on-deep backdrop-blur-sm">
          {category}
        </span>

        {post.language_id && (
          <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-surface/90 py-1 pl-1 pr-3 text-xs font-semibold text-ink shadow-card backdrop-blur-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-on-deep">
              {post.language_id.toUpperCase()}
            </span>
            {language}
          </span>
        )}
      </div>

      {/* Caption */}
      <div className="space-y-1.5 px-1 pt-3">
        {post.unsplash_image_url && (
          <h3 className="text-lg font-bold leading-snug text-ink">{post.phrase}</h3>
        )}
        {post.translation && <p className="text-sm text-muted">{post.translation}</p>}
        {post.source_context && (
          <p className="flex gap-1.5 text-sm text-ink">
            <Quote size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>
              {username && <span className="mr-1 font-semibold">{username}</span>}
              <span className="text-muted">{post.source_context}</span>
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
