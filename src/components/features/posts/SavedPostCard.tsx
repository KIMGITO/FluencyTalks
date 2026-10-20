import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Card } from '@/components/ui';
import { togglePostSave } from '@/services/posts';
import { blocksToText } from '@/lib/blocks';
import { formatTime } from '@/lib/format';
import type { Post } from '@/types/posts';

/** Compact card for the Saved tab: a small link to the main post, not a full
 *  re-render of it. Shows a thumbnail when the post has an image, a short
 *  preview, and an "Open post" link. Tapping the bookmark removes it from saved
 *  (it never deletes the post from the platform). */
export function SavedPostCard({ post, onRemoved }: { post: Post; onRemoved: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const image = post.blocks.find((b) => b.type === 'image');
  const preview = blocksToText(post.blocks ?? []) || post.body_text;
  const unsave = async () => {
    setBusy(true);
    try {
      const s = await togglePostSave(post.id);
      if (!s) onRemoved(post.id);
    } finally { setBusy(false); }
  };
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Link to={post.author_username ? `/u/${post.author_username}` : '#'}><Avatar name={post.author_name ?? '?'} src={post.author_avatar} size="xs" /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{post.author_name}</p>
          <p className="text-xs text-muted">{post.author_username ? `@${post.author_username}` : ''} · {formatTime(post.created_at)}</p>
        </div>
        <button onClick={unsave} disabled={busy} aria-label="Remove from saved" className={clsx('rounded-full p-1.5 text-muted transition', busy ? 'opacity-60' : 'hover:bg-surface-2 hover:text-brand')}>
          <Bookmark size={15} fill="currentColor" />
        </button>
      </div>
      {image?.src && (
        <div className="aspect-[4/3] rounded-lg border border-border bg-surface-2 overflow-hidden">
          <img src={image.src} alt={image.caption ?? ''} className="w-full h-full object-cover" />
        </div>
      )}
      <Link to={`/posts/${post.id}`} className="text-sm font-semibold leading-snug hover:text-brand" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</Link>
      {preview && <p className="text-sm text-muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>}
      <div className="flex items-center gap-1.5 pt-1">
        <Link to={`/posts/${post.id}`} className="ml-auto text-sm font-semibold text-brand hover:underline">Open post</Link>
      </div>
    </Card>
  );
}
