import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { Link } from 'react-router-dom';
import { PostBody } from '@/components/features/posts';
import { getPublicBlog } from '@/services/posts';
import { useSeo } from '@/hooks/useSeo';
import { BRAND } from '@/lib/site';
import { useLanguageStore } from '@/store/languageStore';
import { formatTime } from '@/lib/format';
import type { PublicBlog } from '@/services/posts';

export default function BlogDetail() {
  const { id = '' } = useParams();
  const langName = useLanguageStore((s) => s.name);
  const [blog, setBlog] = useState<PublicBlog | null | undefined>(undefined);
  useEffect(() => {
    setBlog(undefined);
    getPublicBlog(id).then(setBlog).catch(() => setBlog(null));
  }, [id]);
  if (blog === undefined) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (blog === null) return <EmptyState title="Post unavailable" text="It may have been removed." action={<Link to="/blogs"><Button>Back to blog</Button></Link>} />;
  return (
    <>
      <PageHeader title={blog.title} subtitle={blog.language_id ? `Written in ${langName(blog.language_id)}` : undefined} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={blog.author_name ?? '?'} src={blog.author_avatar} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{blog.author_name}
              <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-brand">Blog</span>
            </p>
            <p className="text-xs text-muted">{blog.author_username ? `@${blog.author_username}` : ''} · {formatTime(blog.created_at)} · {blog.read_count} reads</p>
          </div>
        </div>
        <Card className="flex flex-col gap-2">
          <p className="text-xs text-muted">Written in <strong>{langName(blog.language_id ?? 'en')}</strong>. Shown as the author wrote it — translation is for logged-in readers.</p>
          <PostBody blocks={blog.blocks} />
        </Card>
        <div className="flex gap-2">
          <Link to="/blogs"><Button size="sm">Back to blog</Button></Link>
        </div>
      </div>
    </>
  );
}