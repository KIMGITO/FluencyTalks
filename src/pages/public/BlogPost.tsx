import { Link, useParams } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { AUTHOR, POSTS, postBySlug } from '@/content/blog';
import { BRAND, SITE_URL, SITE_URL_WITH_SLASH } from '@/lib/site';
import NotFound from './NotFound';
import '@/styles/landing.css';

export const formatPostDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** One article. BlogPosting + BreadcrumbList structured data sit in the page body, so they are in the prerendered HTML. */
export default function BlogPost() {
  const { slug } = useParams();
  const post = postBySlug(slug);
  useSeo(post
    ? { title: post.seoTitle ?? post.title, description: post.description, path: `/blog/${post.slug}`, type: 'article' }
    : { title: 'Page not found', path: '/404', noIndex: true });
  if (!post) return <NotFound />;

  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.description, url, mainEntityOfPage: url,
      datePublished: post.published, dateModified: post.updated, inLanguage: 'en',
      image: `${SITE_URL}/og-image.png`,
      author: { '@type': 'Organization', name: AUTHOR, url: SITE_URL_WITH_SLASH },
      publisher: { '@type': 'Organization', name: BRAND, url: SITE_URL_WITH_SLASH, logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.png` } },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL_WITH_SLASH },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="lp-wrap">
        <article className="lp-article">
          <header className="lp-doc__head">
            <nav aria-label="Breadcrumb" className="lp-crumbs"><Link to="/">Home</Link> <span aria-hidden="true">/</span> <Link to="/blog">Blog</Link></nav>
            <p className="lp-kicker">{post.kicker}</p>
            <h1>{post.title}</h1>
            <p className="lp-doc__meta">By {AUTHOR} · <time dateTime={post.updated}>{formatPostDate(post.updated)}</time> · {post.readMinutes} min read</p>
          </header>
          <p className="lp-article__summary">{post.summary}</p>
          <div className="lp-article__body">{post.body}</div>
          <aside className="lp-doc__contact">
            <p>Practise this with a native speaker. It's free.</p>
            <Link className="lp-btn lp-btn--accent" to="/signup">Find a language partner</Link>
          </aside>
        </article>
        {more.length > 0 && (
          <nav className="lp-more" aria-labelledby="more-title">
            <h2 id="more-title">Keep reading</h2>
            <ul>{more.map((p) => <li key={p.slug}><Link className="lp-link" to={`/blog/${p.slug}`}>{p.title}</Link></li>)}</ul>
          </nav>
        )}
      </div>
    </PublicShell>
  );
}
