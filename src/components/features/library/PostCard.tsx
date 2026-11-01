import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Flag, MoreVertical, Pencil, Pin, PinOff, Quote, Trash2, UserX } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Button } from '@/components/ui';
import { ReportDialog } from '@/components/features/ReportDialog';
import { blockUser } from '@/services';
import { deleteContribution, pinContribution, toggleSavedPost, type ContributionPost } from '@/services/library';
import { timeAgo } from '@/lib/format';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

export interface PostCardProps {
  post: Omit<ContributionPost, 'author'> & {
    author?: { display_name?: string | null; username?: string; id?: string; avatar_url?: string | null } | null;
  };
  /** `full` (Home, profiles) shows everything; `compact` (Library, Saved) is one tight row that expands on tap. */
  variant?: 'full' | 'compact';
  /** Called when the card should leave the list: deleted, author blocked, or unsaved (with `removeOnUnsave`). */
  onRemoved?: (id: string) => void;
  /** Saved view: unsaving drops the card. */
  removeOnUnsave?: boolean;
  /** Profile view: called after pin/unpin so the list can reorder. */
  onPinChange?: (id: string, pinned: boolean) => void;
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

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/** Rough number of lines the text takes on a phone (~38 characters a line). */
const lineCount = (text: string) =>
  text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.trim().length / 38)), 0);

/** Long text: past this many lines it is set as ordinary body text, like Facebook. */
const LONG_LINES = 10;

/** Facebook-style sizing: short text is big and bold, longer text steps down; very long text is plain. */
function phraseSize(text: string, onPanel: boolean) {
  if (lineCount(text) > LONG_LINES) return 'text-base font-normal';
  const n = text.trim().length;
  if (onPanel) {
    if (n <= 30) return 'text-3xl md:text-4xl font-bold';
    if (n <= 80) return 'text-2xl md:text-3xl font-bold';
    if (n <= 160) return 'text-xl md:text-2xl font-bold';
    return 'text-lg font-semibold';
  }
  if (n <= 40) return 'text-xl font-bold';
  if (n <= 120) return 'text-lg font-bold';
  return 'text-base font-semibold';
}

export function PostCard({ post, variant = 'full', onRemoved, removeOnUnsave, onPinChange }: PostCardProps) {
  const navigate = useNavigate();
  const [removed, setRemoved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [saved, setSaved] = useState(!!post.saved);
  const [pinned, setPinned] = useState(!!post.pinned_at);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const me = useProfileStore((s) => s.me);
  const languageName = useLanguageStore((s) => s.name);
  const isOwner = me?.id === post.user_id;

  useEffect(() => setSaved(!!post.saved), [post.saved]);
  useEffect(() => setPinned(!!post.pinned_at), [post.pinned_at]);

  // Close the menu on any tap outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const remove = () => { setRemoved(true); onRemoved?.(post.id); };
  const run = async (fn: () => Promise<void>) => {
    setMenuOpen(false);
    setNotice('');
    try { await fn(); } catch (e: any) { setNotice(e.message || 'Something went wrong. Please try again.'); }
  };

  const handleDelete = () => run(async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    await deleteContribution(post.id);
    remove();
  });
  const handlePin = () => run(async () => {
    await pinContribution(post.id, !pinned);
    setPinned(!pinned);
    onPinChange?.(post.id, !pinned);
    setNotice(!pinned ? 'Pinned to your profile.' : '');
  });
  const handleSave = () => run(async () => {
    const now = await toggleSavedPost(post.id);
    setSaved(now);
    if (!now && removeOnUnsave) remove();
    else setNotice(now ? 'Saved. Find it under Library → Saved.' : '');
  });
  const authorName = post.author?.display_name || post.author?.username || 'Anonymous';
  const handleBlock = () => run(async () => {
    if (!confirm(`Block ${authorName}? They won't be notified. You'll both disappear from each other's view.`)) return;
    await blockUser(post.user_id);
    remove();
  });

  if (removed) return null;

  const username = post.author?.username;
  const language = post.language_id ? languageName(post.language_id) ?? post.language_id : null;
  const category = CATEGORY_LABELS[post.category] ?? post.category;
  const align = ALIGN[post.text_align ?? 'left'] ?? ALIGN.left;
  const isLong = lineCount(post.phrase) > LONG_LINES;

  const profileLink = (children: React.ReactNode, className?: string) =>
    username ? <Link to={`/u/${username}`} className={className}>{children}</Link> : <span className={className}>{children}</span>;

  const menu = (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" size="sm" aria-label="Post options" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
        <MoreVertical size={16} />
      </Button>
      {menuOpen && (
        <div className="ft-menu right-0 mt-1.5" role="menu">
          {isOwner ? (
            <>
              <button role="menuitem" className="ft-menu-item" onClick={() => navigate(`/library/contribute?edit=${post.id}`)}>
                <Pencil size={14} /> Edit post
              </button>
              <button role="menuitem" className="ft-menu-item" onClick={handlePin}>
                {pinned ? <><PinOff size={14} /> Unpin from profile</> : <><Pin size={14} /> Pin to profile</>}
              </button>
              <button role="menuitem" className="ft-menu-item text-danger hover:bg-danger/10" onClick={handleDelete}>
                <Trash2 size={14} /> Delete post
              </button>
            </>
          ) : (
            <>
              <button role="menuitem" className="ft-menu-item" onClick={handleSave}>
                {saved ? <><BookmarkCheck size={14} /> Remove from saved</> : <><Bookmark size={14} /> Save post</>}
              </button>
              <button role="menuitem" className="ft-menu-item" onClick={() => { setMenuOpen(false); setReporting(true); }}>
                <Flag size={14} /> Report post
              </button>
              <button role="menuitem" className="ft-menu-item text-danger hover:bg-danger/10" onClick={handleBlock}>
                <UserX size={14} /> Block {authorName}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const extras = (
    <>
      {notice && <p className="px-1 pt-2 text-xs text-muted" role="status">{notice}</p>}
      {!isOwner && <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={post.user_id} postId={post.id} />}
    </>
  );

  // ---------- Compact: one row — thumbnail, two lines of text, meta. Tap to expand to the full card. ----------
  if (variant === 'compact' && !expanded) {
    return (
      <article className="ft-card p-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
            aria-label={`Open post: ${post.phrase}`}
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-soft">
              {post.unsplash_image_url
                ? <img src={post.unsplash_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                : <span className="font-mono text-xs font-bold text-brand">{(post.language_id ?? category).toUpperCase().slice(0, 3)}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{post.phrase}</span>
              {post.translation && <span className="mt-0.5 line-clamp-1 text-xs text-muted">{post.translation}</span>}
              <span className="mt-1 block truncate text-2xs text-muted">
                {pinned && '📌 '}{authorName} · {timeAgo(post.created_at)} · {category}{language && ` · ${language}`}
              </span>
            </span>
          </button>
          {menu}
        </div>
        {extras}
      </article>
    );
  }

  // ---------- Full ----------
  return (
    <article className="ft-card overflow-hidden p-3 md:p-4">
      {pinned && (
        <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted">
          <Pin size={12} className="text-accent" /> Pinned
        </p>
      )}
      {/* Author row */}
      <header className="flex items-center gap-3 px-1">
        {profileLink(
          <span className="flex aspect-square rounded-full border-2 border-accent p-0.5">
            <Avatar name={authorName} src={post.author?.avatar_url} size="md" />
          </span>,
          'flex shrink-0',
        )}
        <div className="min-w-0 flex-1">
          {profileLink(authorName, 'block truncate font-semibold text-ink hover:underline')}
          <p className="truncate text-xs text-muted">
            {timeAgo(post.created_at)}
            {language && ` · ${language}`}
          </p>
        </div>
        {variant === 'compact' && (
          <button type="button" onClick={() => setExpanded(false)} className="text-xs font-semibold text-muted hover:text-ink">
            Show less
          </button>
        )}
        {menu}
      </header>

      {/* Media: the image; for text-only posts the phrase on a tinted panel at least 6 lines tall,
          or — when it runs past 10 lines — as ordinary text with no panel. */}
      {post.unsplash_image_url || !isLong ? (
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
            <div className={clsx('flex min-h-[9.6rem] items-center px-6 pb-14 pt-12', align)}>
              <p className={clsx('w-full whitespace-pre-line break-words leading-snug text-ink', phraseSize(post.phrase, true))}>{post.phrase}</p>
            </div>
          )}

          <span className="absolute right-3 top-3 rounded-full bg-ink/60 px-2.5 py-0.5 text-xs font-semibold text-on-deep backdrop-blur-sm">
            {category}
          </span>

          {post.language_id && (
            <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-surface/90 py-1 pl-1 pr-3 text-xs font-semibold text-ink shadow-card backdrop-blur-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-mono text-2xs font-bold text-on-deep">
                {post.language_id.toUpperCase()}
              </span>
              {language}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-xs">
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold text-ink">{category}</span>
          {post.language_id && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-semibold text-ink">{language}</span>
          )}
        </div>
      )}

      {/* Caption */}
      <div className={clsx('space-y-1.5 px-1 pt-3', align)}>
        {(post.unsplash_image_url || isLong) && (
          <h3 className={clsx('whitespace-pre-line break-words leading-relaxed text-ink', phraseSize(post.phrase, false))}>{post.phrase}</h3>
        )}
        {post.translation && <p className="whitespace-pre-line text-sm text-muted">{post.translation}</p>}
        {post.source_context && (
          <p className={clsx('flex gap-1.5 text-sm text-ink', post.text_align === 'center' && 'justify-center', post.text_align === 'right' && 'justify-end')}>
            <Quote size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>
              {username && <span className="mr-1 font-semibold">{username}</span>}
              <span className="text-muted">{post.source_context}</span>
            </span>
          </p>
        )}
      </div>
      {extras}
    </article>
  );
}
