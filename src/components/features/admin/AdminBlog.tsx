import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudOff, Eye, FilePen, Newspaper, Plus, Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, RowListSkeleton } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { formatTime, timeAgo } from '@/lib/format';
import { adminBlogDelete, adminBlogList, adminBlogUnpublish, type AdminPost } from '@/services/blog';
import { toast } from '@/store/toastStore';
import { ActionMenu, Chip, IconTile, RefreshButton, Toolbar } from './AdminKit';

export const blogPostStatus = (p: Pick<AdminPost, 'is_live' | 'has_changes'>) => (!p.is_live ? 'Draft' : p.has_changes ? 'Live, with unpublished changes' : 'Live');

export const BlogStatusChip = ({ post }: { post: Pick<AdminPost, 'is_live' | 'has_changes'> }) => (
  <Chip tone={!post.is_live ? 'muted' : post.has_changes ? 'sun' : 'success'}>{blogPostStatus(post)}</Chip>
);

/** The list of posts, drafts and live. Writing happens in BlogEditor. */
export function AdminBlog() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<AdminPost | null>(null);
  const [hiding, setHiding] = useState<AdminPost | null>(null);
  const refresh = useAction(async () => { setPosts(await adminBlogList()); setFailed(false); });
  useEffect(() => { adminBlogList().then(setPosts).catch(() => setFailed(true)); }, []);
  if (failed && !posts) return <ErrorState title="Couldn't load the posts" onRetry={() => void refresh.run()} busy={refresh.busy} />;
  if (!posts) return <RowListSkeleton label="Loading the posts" />;
  return (
    <div className="space-y-4">
      <Toolbar>
        <Button size="sm" onClick={() => navigate('/admin/blog/new')}><Plus size={16} aria-hidden /> New post</Button>
        <RefreshButton busy={refresh.busy} onClick={() => void refresh.run()} />
      </Toolbar>
      {!posts.length ? <EmptyState icon={<IconTile icon={Newspaper} />} title="No posts yet" text="Write the first one. It stays private until you publish it." /> : (
        <Card pad={false}>
          <ul className="divide-y divide-border">
            {posts.map((p) => {
              const title = p.draft.title?.trim() || p.live_title || 'Untitled post';
              return (
                <li key={p.id} className="flex items-center gap-3 p-3 md:px-4">
                  {p.draft.cover_url
                    ? <img src={p.draft.cover_url} alt="" loading="lazy" className="hidden aspect-video w-24 shrink-0 rounded-md object-cover sm:block" />
                    : <span aria-hidden className="hidden aspect-video w-24 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted sm:flex"><Newspaper size={20} /></span>}
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/blog/${p.id}`} className="block break-words font-display text-lg font-medium leading-snug hover:underline">{title}</Link>
                    <p className="truncate text-xs text-muted">/blog/{p.slug}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <BlogStatusChip post={p} />
                      <span title={formatTime(p.draft_saved_at)}>Saved {timeAgo(p.draft_saved_at)}</span>
                    </p>
                  </div>
                  <ActionMenu label={`Actions for ${title}`} actions={[
                    { label: 'Edit', icon: FilePen, onSelect: () => navigate(`/admin/blog/${p.id}`) },
                    ...(p.is_live ? [
                      { label: 'View on the site', icon: Eye, onSelect: () => window.open(`/blog/${p.slug}`, '_blank', 'noopener') },
                      { label: 'Take off the site', icon: CloudOff, onSelect: () => setHiding(p) },
                    ] : []),
                    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(p) },
                  ]} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <ConfirmDialog open={!!hiding} title="Take this post off the site?" confirmLabel="Take off the site" onClose={() => setHiding(null)}
        onConfirm={async () => { await adminBlogUnpublish(hiding!.id); await refresh.run(); toast.success('The post is off the site. It is still here as a draft.'); }}>
        <p><b>{hiding?.live_title}</b> stops being public within about a minute. You can publish it again at the same address.</p>
      </ConfirmDialog>
      <ConfirmDialog open={!!deleting} title="Delete this post?" confirmLabel="Delete for good" danger onClose={() => setDeleting(null)}
        onConfirm={async () => { await adminBlogDelete(deleting!.id); setPosts((all) => all?.filter((x) => x.id !== deleting!.id) ?? null); toast.success('Post deleted.'); }}>
        <p><b>{deleting?.draft.title || deleting?.live_title || 'This post'}</b> and its images are removed for good. {deleting?.is_live && 'Links to it will show a "page not found" page within about a minute.'}</p>
      </ConfirmDialog>
    </div>
  );
}
