import { Link, useParams } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { LANGUAGES, languageBySlug } from '@/content/languages';
import { POSTS } from '@/content/blog';
import { BRAND, SITE_URL, SITE_URL_WITH_SLASH } from '@/lib/site';
import NotFound from './NotFound';
import '@/styles/landing.css';

/** One language: "Practise Swahili with native speakers". Prerendered to static HTML for each launch language. */
export default function LanguagePage() {
  const { slug } = useParams();
  const l = languageBySlug(slug);
  useSeo(l
    ? {
      title: `${l.name} Language Exchange: Practise with Native Speakers`,
      description: `Find a ${l.name} language exchange partner. Chat with native ${l.name} speakers, get your sentences corrected inside the conversation, and save every phrase. Free.`,
      path: `/languages/${l.slug}`,
    }
    : { title: 'Page not found', path: '/404', noIndex: true });
  if (!l) return <NotFound />;

  const url = `${SITE_URL}/languages/${l.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL_WITH_SLASH },
      { '@type': 'ListItem', position: 2, name: 'Languages', item: `${SITE_URL}/languages` },
      { '@type': 'ListItem', position: 3, name: l.name, item: url },
    ],
  };
  const near = LANGUAGES.filter((o) => o.region === l.region && o.id !== l.id);
  const greet = (text: string) => <span lang={l.lang} dir={l.rtl ? 'rtl' : undefined}>{text}</span>;

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="lp-wrap">
        <article className="lp-article">
          <header className="lp-doc__head">
            <nav aria-label="Breadcrumb" className="lp-crumbs"><Link to="/">Home</Link> <span aria-hidden="true">/</span> <Link to="/languages">Languages</Link></nav>
            <p className="lp-kicker">{l.region}</p>
            <h1>Practise {l.name} with native speakers</h1>
          </header>
          <p className="lp-article__summary">Find a {l.name} language exchange partner on {BRAND}. Chat with people who speak {l.name} natively, get your sentences corrected inside the conversation, and keep every correction in your phrasebook. It is free.</p>

          <dl className="lp-langfacts">
            {l.native !== l.name && <div><dt>In {l.name}</dt><dd>{greet(l.native)}</dd></div>}
            <div><dt>Spoken in</dt><dd>{l.where}</dd></div>
            <div><dt>Written in</dt><dd>{l.script} script</dd></div>
            {l.hello && <div><dt>Hello</dt><dd>{greet(l.hello)}</dd></div>}
            {l.thanks && <div><dt>Thank you</dt><dd>{greet(l.thanks)}</dd></div>}
          </dl>

          <div className="lp-article__body">
            <h2>How to practise {l.name} here</h2>
            <ol>
              <li><strong>Say who you are.</strong> Choose {l.name} as the language you are learning, and your level from A1 (beginner) to C2 (near-native).</li>
              <li><strong>Meet a match.</strong> We suggest people who speak {l.name} natively and people learning your language whom you can help. Send a message; they can accept or decline.</li>
              <li><strong>Talk, get corrected, keep it.</strong> Your partner fixes a sentence right where you wrote it. Accept the change and the phrase goes into your phrasebook.</li>
            </ol>
            <p>Practice happens in text chat, so you can take your time, look words up, and read every correction again later. New to this? Read <Link to="/blog/what-is-a-language-exchange">what a language exchange is</Link> and <Link to="/blog/find-a-language-exchange-partner">how to find a good partner</Link>.</p>

            <h2>Already speak {l.name}?</h2>
            <p>Choose {l.name} as your native language and help someone a few steps behind you. Each correction the learner accepts earns you 5 points, and a bounty answer they accept earns you 50. You can also post {l.name} phrases, idioms, usage notes and grammar tips to the community library.</p>

            <h2>Questions about practising {l.name}</h2>
            <ul>
              <li><strong>Is it free?</strong> Yes. {BRAND} has no paid plans.</li>
              <li><strong>Do I need to be good already?</strong> No. Beginners are welcome; your partner corrects you as you go.</li>
              <li><strong>Who can correct me?</strong> Native {l.name} speakers, and learners whose practice has verified them at B1 or above.</li>
              <li><strong>Is it safe?</strong> New contacts arrive as requests you can decline, and you can block or report anyone.</li>
            </ul>
            <p>More advice: <Link to="/blog/corrections-from-native-speakers">how to get corrections from native speakers</Link>.</p>
          </div>

          <aside className="lp-doc__contact">
            <p>Find a {l.name} partner today. It's free.</p>
            <Link className="lp-btn lp-btn--accent" to="/signup">Start practising {l.name}</Link>
          </aside>
        </article>

        <nav className="lp-more" aria-labelledby="near-title">
          <h2 id="near-title">More {l.region}</h2>
          <ul className="lp-more__inline">
            {near.map((o) => <li key={o.id}><Link className="lp-link" to={`/languages/${o.slug}`}>{o.name}</Link></li>)}
            <li><Link className="lp-link" to="/languages">All {LANGUAGES.length} languages</Link></li>
          </ul>
          {POSTS.length > 0 && <p className="lp-doc__meta">Guides: {POSTS.map((p, i) => <span key={p.slug}>{i > 0 && ' · '}<Link to={`/blog/${p.slug}`}>{p.title}</Link></span>)}</p>}
        </nav>
      </div>
    </PublicShell>
  );
}
