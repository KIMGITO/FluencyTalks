import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { PublicBlogCard } from '@/components/features/posts';
import { listPublicBlogs } from '@/services/posts';
import type { PublicBlog } from '@/services/posts';
import { useSeo } from '@/hooks/useSeo';
import { BRAND } from '@/lib/site';

export default function Blogs() {
  useSeo({ title: 'Blog', description: 'Public language-learning stories and blog posts anyone can read.', path: '/blogs' });
  const [blogs, setBlogs] = useState<PublicBlog[] | null>(null);
  useEffect(() => {
    listPublicBlogs().then(setBlogs).catch(() => setBlogs([]));
  }, []);
  return (
    <>
      <PageHeader title="Blog" subtitle="Stories and posts shared publicly — anyone can read, no account needed." />
      {!blogs ? <div className="flex justify-center p-8"><Spinner /></div>
      : !blogs.length ? <EmptyState title="No blog posts yet" text="Be the first to share a story once you log in." action={<Link to="/login"><Button>Log in</Button></Link>} />
      : <div className="flex flex-col gap-2">{blogs.map((b) => <PublicBlogCard key={b.id} blog={b} />)}</div>}
    </>
  );
}