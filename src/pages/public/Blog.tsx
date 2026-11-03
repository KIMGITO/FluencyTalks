import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/landing';
import { useBlogLinks } from '@/hooks/useBlogLinks';
import { useSeo } from '@/hooks/useSeo';
import { BLOG_MARK, postCardsHtml, type PostCard } from '@/lib/blogHtml';
import { blogPayload, listLivePosts } from '@/services/blog';
import '@/styles/landing.css';

/** The blog index. worker/index.ts fills it in on the server from the database, so crawlers get the posts as HTML. */
export default function Blog() {
  useSeo({
    title: 'Language Learning Guides and Tips | The Fluency Talks Blog',
    description: 'Practical guides on language exchange, speaking confidence and learning with native speakers, written for real learners from A1 to C2.',
    path: '/blog',
  });
  const [posts, setPosts] = useState<PostCard[] | null>(() => blogPayload<{ posts: PostCard[] }>('/blog')?.posts ?? null);
  const [failed, setFailed] = useState(false);
  const onClick = useBlogLinks();
  useEffect(() => {
    if (posts) return;
    listLivePosts().then(setPosts).catch(() => setFailed(true));
  }, []);
  const ssr = typeof document === 'undefined';
  return (
    <PublicShell>
      <div className="lp-wrap">
        <header className="lp-doc__head lp-blog__head">
          <p className="lp-kicker">The Fluency Talks blog</p>
          <h1>Language learning guides</h1>
          <p className="lp-lead lp-blog__lead">Practical advice on language exchange, speaking with native speakers and turning corrections into fluency.</p>
        </header>
        {failed && <p className="lp-blog__note" role="alert">We couldn't load the guides. Please refresh the page to try again.</p>}
        {!failed && !ssr && !posts && <p className="lp-blog__note" role="status">Loading the guides…</p>}
        {posts && !posts.length && <p className="lp-blog__note">New guides are on the way. Please check back soon.</p>}
        {(ssr || !!posts?.length) && <ul className="lp-postgrid" onClick={onClick} dangerouslySetInnerHTML={{ __html: ssr ? BLOG_MARK : postCardsHtml(posts ?? []) }} />}
      </div>
    </PublicShell>
  );
}
