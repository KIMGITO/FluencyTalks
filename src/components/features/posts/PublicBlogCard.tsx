import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Card } from '@/components/ui';
import { PostBody } from './PostBody';
import { formatTime } from '@/lib/format';
import { useLanguageStore } from '@/store/languageStore';
import type { PublicBlog } from '@/services/posts';

export function PublicBlogCard({ blog }: { blog: PublicBlog }) {
  const langName = useLanguageStore((s) => s.name);
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Avatar name={blog.author_name ?? '?'} src={blog.author_avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{blog.author_name}
            <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-brand">Blog</span>
          </p>
          <p className="flex items-center gap-1 text-xs text-muted">{blog.author_username ? `@${blog.author_username}` : ''} · {formatTime(blog.created_at)}</p>
        </div>
      </div>
      <Link to={`/blogs/${blog.id}`} className="text-base font-bold leading-snug hover:text-brand">{blog.title}</Link>
      {blog.language_id && (
        <p><span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-muted">Written in {langName(blog.language_id)}</span></p>
      )}
      <PostBody blocks={blog.blocks} clamp />
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button disabled aria-label="Reads" className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted bg-surface-2')}>
          <Eye size={16} /> {blog.read_count} Reads
        </button>
        <Link to={`/blogs/${blog.id}`} className="ml-auto text-sm font-semibold text-brand hover:underline">Open</Link>
      </div>
    </Card>
  );
}