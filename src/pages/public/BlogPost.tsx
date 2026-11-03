import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useBlogLinks } from '@/hooks/useBlogLinks';
import { useSeo } from '@/hooks/useSeo';
import { BLOG_MARK, postHtml, type Post, type PostCard } from '@/lib/blogHtml';
import { blogPayload, getLivePost, listLivePosts } from '@/services/blog';
import NotFound from './NotFound';
import '@/styles/landing.css';

interface Loaded { post: Post | null; more: PostCard[] }

/** One post. worker/index.ts serves it as finished HTML with its data alongside; a tap from /blog loads it here. */
export default function BlogPost() {
  const { slug = '' } = useParams();
  const path = `/blog/${slug}`;
  const [state, setState] = useState<(Loaded & { path: string }) | null>(() => blogPayload<Loaded & { path: string }>(path));
  const [failed, setFailed] = useState(false);
  const onClick = useBlogLinks();
  const ssr = typeof document === 'undefined';
  useEffect(() => {
    if (state?.path === path) return undefined;
    let current = true;
    setFailed(false);
    Promise.all([getLivePost(slug), listLivePosts(4)])
      .then(([post, list]) => { if (current) setState({ path, post, more: list.filter((p) => p.slug !== slug).slice(0, 3) }); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [path]);

  const post = state?.path === path ? state.post : null;
  useSeo(ssr
    // The shell the Worker fills in. It carries noindex until the Worker replaces it.
    ? { title: 'The Fluency Talks blog post', description: 'A guide from The Fluency Talks.', path, noIndex: true, type: 'article' }
    : post
      ? { title: post.seo_title || post.title, description: post.description, path, type: 'article', image: post.cover_url ?? undefined }
      : { title: 'The Fluency Talks blog', path, noIndex: true });

  if (state?.path === path && !post) return <NotFound />;
  return (
    <PublicShell>
      <div className="lp-wrap" onClick={onClick}>
        {ssr && <div dangerouslySetInnerHTML={{ __html: BLOG_MARK }} />}
        {post && <div dangerouslySetInnerHTML={{ __html: postHtml(post, state?.more ?? []) }} />}
        {!ssr && !post && <p className="lp-blog__note" role={failed ? 'alert' : 'status'}>{failed ? "We couldn't load this guide. Please refresh the page to try again." : 'Loading the guide…'}</p>}
      </div>
    </PublicShell>
  );
}
