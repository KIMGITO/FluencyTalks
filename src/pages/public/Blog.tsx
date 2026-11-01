import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { POSTS } from '@/content/blog';
import { formatPostDate } from './BlogPost';
import '@/styles/landing.css';

/** The blog index: learning guides for people who are not ready to sign up yet. Prerendered to static HTML. */
export default function Blog() {
  useSeo({
    title: 'Language Learning Guides and Tips | The Fluency Talks Blog',
    description: 'Practical guides on language exchange, speaking confidence and learning with native speakers, written for real learners from A1 to C2.',
    path: '/blog',
  });
  return (
    <PublicShell>
      <div className="lp-wrap">
        <header className="lp-doc__head">
          <p className="lp-kicker">The Fluency Talks blog</p>
          <h1>Language learning guides</h1>
          <p className="lp-lead lp-blog__lead">Practical advice on language exchange, speaking with native speakers and turning corrections into fluency.</p>
        </header>
        <ul className="lp-posts">
          {POSTS.map((p) => (
            <li key={p.slug}>
              <article>
                <p className="lp-kicker">{p.kicker}</p>
                <h2><Link to={`/blog/${p.slug}`}>{p.title}</Link></h2>
                <p>{p.description}</p>
                <p className="lp-doc__meta"><time dateTime={p.published}>{formatPostDate(p.published)}</time> · {p.readMinutes} min read</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </PublicShell>
  );
}
