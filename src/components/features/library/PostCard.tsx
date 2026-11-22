import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Flag, MessageCircle, MoreVertical, Pencil, PencilLine, Pin, PinOff, Quote, ThumbsUp, Trash2, UserX } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Button, ConfirmDialog, MenuItem } from '@/components/ui';
import { canCorrect } from '@/lib/corrections';
import { FIX_LABEL, isPractice, POST_TYPE_LABEL } from '@/lib/postTypes';
import { CATEGORY_LOOK, LESSON_LOOK, PRACTICE_LOOK } from './postLooks';
import { StatusPill } from '@/components/features/review/StatusPill';
import { LikeButton, useLike } from './LikeButton';
import { toast } from '@/store/toastStore';
import { ReportDialog } from '@/components/features/ReportDialog';
import { blockUser } from '@/services';
import { deleteContribution, pinContribution, toggleSavedPost, type ContributionPost } from '@/services/library';
import { timeAgo } from '@/lib/format';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { useFeedCache } from '@/store/feedCache';
import { userMessage } from '@/lib/errors';

export interface PostCardProps {
  post: Omit<ContributionPost, 'author'> & {
    author?: { display_name?: string | null; username?: string; id?: string; avatar_url?: string | null } | null;
  };
  /** `full` (Home, profiles) shows pictures; `compact` (Library, Saved, Search) leaves them out to keep lists tight. */
  variant?: 'full' | 'compact';
  /** Called when the card should leave the list: deleted, author blocked, or unsaved (with `removeOnUnsave`). */
  onRemoved?: (id: string) => void;
  /** Saved view: unsaving drops the card. */
  removeOnUnsave?: boolean;
  /** Profile view: called after pin/unpin so the list can reorder. */
  onPinChange?: (id: string, pinned: boolean) => void;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/** Shows at most 6 lines (the minimum card); a See more / See less toggle appears only when the text is cut off. */
function ClampText({ children, className, align }: { children: React.ReactNode; className?: string; align?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, open]);
  return (
    <div className={clsx('w-full', align)}>
      <p ref={ref} className={clsx('whitespace-pre-line break-words', !open && 'line-clamp-6', className)}>{children}</p>
      {(overflows || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-sm font-semibold text-muted hover:text-ink">
          {open ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}

/** Text on a photo. The scrim holds the contrast on any photo, bright or dark, in both themes. */
function OverlayImage({ src, text, align }: { src: string; text: string; align?: string }) {
  return (
    <span className="relative block overflow-hidden rounded-xl bg-deep">
      <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
      <span className="absolute inset-0 flex items-center bg-deep/70 p-5">
        <span className={clsx('line-clamp-6 w-full whitespace-pre-line break-words font-display text-2xl font-bold leading-snug text-on-deep md:text-3xl', align)}>{text}</span>
      </span>
    </span>
  );
}

export function PostCard({ post, variant = 'full', onRemoved, removeOnUnsave, onPinChange }: PostCardProps) {
  const navigate = useNavigate();
  const [removed, setRemoved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [saved, setSaved] = useState(!!post.saved);
  const [pinned, setPinned] = useState(!!post.pinned_at);
  const [confirming, setConfirming] = useState<'delete' | 'block' | null>(null);
  const saving = useRef(false);
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

  const cache = useFeedCache.getState();   // actions only — no re-render on every cache change
  const remove = () => { setRemoved(true); onRemoved?.(post.id); };
  const run = async (fn: () => Promise<void>) => {
    setMenuOpen(false);
    try { await fn(); } catch (e: any) { toast.error(userMessage(e, 'Oops! Something went wrong. Please try again.'), () => { void run(fn); }); }
  };

  const handleDelete = async () => {
    await deleteContribution(post.id);
    cache.removeEverywhere(post.id);   // gone from Home, Library, profile and Saved lists
    remove();
    toast.success('Post deleted.');
  };
  const handlePin = () => run(async () => {
    await pinContribution(post.id, !pinned);
    setPinned(!pinned);
    if (!pinned) cache.patchEverywhere(post.id, { pinned_at: new Date().toISOString() });
    else cache.patchEverywhere(post.id, { pinned_at: null });
    cache.invalidate(`posts:user:${post.user_id}`);   // profile order changes (one pinned post)
    onPinChange?.(post.id, !pinned);
    toast.success(!pinned ? 'Pinned to your profile.' : 'Unpinned.');
  });
  // Changes at once, then settles on what the server says; goes back if it failed.
  const handleSave = async () => {
    setMenuOpen(false);
    if (saving.current) return;
    saving.current = true;
    const was = saved;
    setSaved(!was);
    try {
      const now = await toggleSavedPost(post.id);
      setSaved(now);
      cache.patchEverywhere(post.id, { saved: now });
      cache.invalidate('posts:saved');
      if (!now && removeOnUnsave) remove();
      toast.success(now ? 'Saved. Find it under Library, Saved.' : 'Removed from saved.');
    } catch (e: any) {
      setSaved(was);
      toast.error(userMessage(e, 'Could not save this post.'));
    } finally { saving.current = false; }
  };
  const authorName = post.author?.display_name || post.author?.username || 'Anonymous';
  const handleBlock = async () => {
    await blockUser(post.user_id);
    cache.removeByUser(post.user_id);
    remove();
    toast.success(`${authorName} is blocked.`);
  };

  const like = useLike(post.id, post.liked, post.like_count);
  if (removed) return null;

  const username = post.author?.username;
  // What a reader should trust: the accepted correction when there is one. The original stays one tap away.
  const shownPhrase = post.current_phrase ?? post.phrase;
  const shownTranslation = post.current_translation ?? post.translation;
  const threadLink = `/library/post/${post.id}`;
  const threadSize = post.thread_count ?? 0;
  const language = post.language_id ? languageName(post.language_id) ?? post.language_id : null;
  const isLesson = post.post_type === 'lesson';
  const look = isLesson ? LESSON_LOOK : CATEGORY_LOOK[post.category] ?? CATEGORY_LOOK.phrase;
  const category = look.label;
  const overlaid = post.image_layout === 'overlay' && !!post.unsplash_image_url;
  const lessonText = post.current_body ?? post.body;
  const align = ALIGN[post.text_align ?? 'left'] ?? ALIGN.left;

  const profileLink = (children: React.ReactNode, className?: string) =>
    username ? <Link to={`/u/${username}`} className={className}>{children}</Link> : <span className={className}>{children}</span>;

  const practice = isPractice(post.post_type) ? post.post_type : null;
  const kind = practice ? { icon: PRACTICE_LOOK[practice].icon, label: POST_TYPE_LABEL[practice] } : { icon: look.icon, label: category };
  const canFix = !isOwner && !!practice && (practice === 'question' || canCorrect(me, post.language_id));

  // On phones, Like and Fix live in this menu; from `sm` up they're icon buttons under the post.
  const menu = (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" size="sm" aria-label="Post options" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
        <MoreVertical size={16} />
      </Button>
      {menuOpen && (
        <div className="ft-menu right-0 mt-1.5" role="menu">
          <MenuItem role="menuitem" className="sm:hidden" onClick={() => { setMenuOpen(false); void like.toggle(); }}>
            <ThumbsUp size={14} /> {like.liked ? 'Unlike' : 'Like'}{like.count > 0 && ` · ${like.count}`}
          </MenuItem>
          {canFix && (
            <MenuItem role="menuitem" className="sm:hidden" onClick={() => navigate(threadLink)}>
              <PencilLine size={14} /> {FIX_LABEL[practice!]}
            </MenuItem>)}
          {isOwner ? (
            <>
              <MenuItem role="menuitem" onClick={() => navigate(`/library/contribute?edit=${post.id}`)}>
                <Pencil size={14} /> Edit post
              </MenuItem>
              <MenuItem role="menuitem" onClick={handlePin}>
                {pinned ? <><PinOff size={14} /> Unpin from profile</> : <><Pin size={14} /> Pin to profile</>}
              </MenuItem>
              <MenuItem role="menuitem" danger onClick={() => { setMenuOpen(false); setConfirming('delete'); }}>
                <Trash2 size={14} /> Delete post
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem role="menuitem" onClick={handleSave}>
                {saved ? <><BookmarkCheck size={14} /> Remove from saved</> : <><Bookmark size={14} /> Save post</>}
              </MenuItem>
              <MenuItem role="menuitem" onClick={() => { setMenuOpen(false); setReporting(true); }}>
                <Flag size={14} /> Report post
              </MenuItem>
              <MenuItem role="menuitem" danger onClick={() => { setMenuOpen(false); setConfirming('block'); }}>
                <UserX size={14} /> Block {authorName}
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );

  const extras = (
    <>
      <ConfirmDialog open={confirming === 'delete'} title="Delete this post?" confirmLabel="Delete" danger onClose={() => setConfirming(null)} onConfirm={handleDelete}>
        The post and its discussion go away for everyone. This can't be undone.
      </ConfirmDialog>
      <ConfirmDialog open={confirming === 'block'} title={`Block ${authorName}?`} confirmLabel="Block" danger onClose={() => setConfirming(null)} onConfirm={handleBlock}>
        They won't be told. You'll both disappear from each other's view.
      </ConfirmDialog>
      {!isOwner && <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={post.user_id} postId={post.id} />}
    </>
  );

  // ---------- One layout for every post, like a social feed: avatar on the left, the post beside it,
  // an icon action bar underneath. Tapping the text or picture opens the discussion. ----------
  const answered = practice === 'question' || practice === 'how_do_i_say';
  const status = post.review_status ?? 'awaiting_feedback';
  const short = variant === 'compact';
  const image = post.unsplash_image_url;
  const caption = practice ? post.phrase : shownPhrase;
  const openThread = (e: React.MouseEvent) => {
    // Links, buttons and selecting text keep doing their own thing.
    if ((e.target as HTMLElement).closest('a, button') || window.getSelection()?.toString()) return;
    navigate(threadLink);
  };

  return (
    <article className="ft-card px-3 pb-1 pt-3 transition-colors hover:bg-surface-2/40 md:px-4">
      {pinned && (
        <p className="mb-1 flex items-center gap-1.5 pl-[3.25rem] text-xs font-semibold text-muted">
          <Pin size={12} aria-hidden /> Pinned
        </p>
      )}
      <div className="flex gap-3">
        {profileLink(<Avatar name={authorName} src={post.author?.avatar_url} size="md" />, 'flex h-fit shrink-0')}
        <div className="min-w-0 flex-1">
          {/* Name · @handle · time, and the ⋮ menu at the end */}
          <header className="flex items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1 text-sm leading-5">
              {profileLink(authorName, 'max-w-full truncate font-bold text-ink hover:underline')}
              {username && <span className="min-w-0 truncate text-muted">@{username}</span>}
              <span aria-hidden className="text-muted">·</span>
              <Link to={threadLink} className="shrink-0 text-muted hover:underline">{timeAgo(post.created_at)}</Link>
            </div>
            <div className="-mr-2 -mt-1.5 shrink-0">{menu}</div>
          </header>
          <p className="flex items-center gap-1 text-xs text-muted">
            <kind.icon size={12} aria-hidden /> {kind.label}{language && ` · ${language}`}
            {status !== 'awaiting_feedback' && <StatusPill className="ml-1" status={status} label={answered && status === 'corrections_received' ? 'Answers received' : undefined} />}
          </p>

          <div onClick={openThread} className="cursor-pointer">
            {/* Text */}
            <div className="mt-1.5 space-y-1.5 text-[15px] leading-relaxed text-ink">
              {practice === 'story' ? (
                <>
                  <p className="break-words font-semibold">{post.phrase}</p>
                  <ClampText>{post.current_body ?? post.body}</ClampText>
                </>
              ) : practice === 'question' ? (
                <>
                  <ClampText className="font-semibold">{post.phrase}</ClampText>
                  {post.body && <ClampText className="text-muted">{post.body}</ClampText>}
                </>
              ) : !overlaid && <ClampText>{caption}</ClampText>}
              {!practice && lessonText && <ClampText>{lessonText}</ClampText>}
              {!practice && shownTranslation && <p className="whitespace-pre-line text-sm text-muted">{shownTranslation}</p>}
              {post.accepted_item_id && !practice && <p className="truncate text-xs text-muted">Original: {post.phrase}</p>}
              {post.source_context && (
                practice
                  ? <p className="text-sm text-muted">{(practice === 'correct_me' || practice === 'photo') && 'Trying to say: '}{post.source_context}</p>
                  : <p className="flex gap-1.5 text-sm text-muted"><Quote size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />{post.source_context}</p>
              )}
            </div>

            {/* Picture */}
            {image && !short && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                {overlaid
                  ? <OverlayImage src={image} text={caption} align={align} />
                  : <img src={image} alt={caption} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
              </div>
            )}
            {image && short && overlaid && <p className="mt-1.5 break-words text-[15px] text-ink">{caption}</p>}
          </div>

          {/* Actions: like, fix and save on the left (in the ⋮ menu on phones), reply on the right */}
          <div className="-mx-2.5 mt-1 flex items-center">
            <div className="hidden items-center gap-1 sm:flex">
              <LikeButton like={like} />
              {canFix && (
                <Link to={threadLink} title={FIX_LABEL[practice!]} aria-label={FIX_LABEL[practice!]}
                  className="inline-flex min-h-10 items-center rounded-full px-2.5 text-muted transition hover:bg-surface-2 hover:text-ink">
                  <PencilLine size={16} aria-hidden />
                </Link>)}
              {!isOwner && (
                <button type="button" onClick={() => void handleSave()} title={saved ? 'Remove from saved' : 'Save'} aria-label={saved ? 'Remove from saved' : 'Save'} aria-pressed={saved}
                  className={clsx('inline-flex min-h-10 items-center rounded-full px-2.5 transition hover:bg-surface-2', saved ? 'text-accent' : 'text-muted hover:text-ink')}>
                  {saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
                </button>)}
            </div>
            <Link to={threadLink} title="Reply" aria-label={threadSize ? `${threadSize} replies` : 'Reply'}
              className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink">
              {(post.open_corrections ?? 0) > 0 && <span className="font-normal">{post.open_corrections} open ·</span>}
              <MessageCircle size={16} aria-hidden />{threadSize > 0 && threadSize}
            </Link>
          </div>
        </div>
      </div>
      {extras}
    </article>
  );
}
