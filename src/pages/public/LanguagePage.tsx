import { Link, useParams } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { LANGUAGES, languageBySlug } from '@/content/languages';
import { BRAND, SITE_URL, SITE_URL_WITH_SLASH } from '@/lib/site';
import NotFound from './NotFound';
import '@/styles/landing.css';

/** One language: "Practise Swahili with native speakers". Prerendered to static HTML for each launch language. */
export default function LanguagePage() {
  const { slug } = useParams();
  const l = languageBySlug(slug);
  useSeo(l
    ? {
      title: `Practise ${l.name} with Native Speakers`,   // 60 characters or fewer with the brand, so Google does not cut it off
      description: `Find a ${l.name} language exchange partner. Video call native ${l.name} speakers on topics for your level, get rated, and move up from A1 to C2. Free.`,
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
          <p className="lp-article__summary">Find a {l.name} language exchange partner on {BRAND}. Talk on video calls with people who speak {l.name} natively, about topics that match your level, and pass each level with ratings from your partners. It is free.</p>

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
              <li><strong>Meet a match.</strong> We suggest everyone who speaks {l.name} natively, even if they are learning nothing, and anyone learning your language. A perfect swap comes first but is never required. Add them as a partner; they can accept or decline.</li>
              <li><strong>Call and talk.</strong> Call your partner and pick one of the {l.name} topics at your level. Each comes with prompts and ideas.</li>
              <li><strong>Get rated, move up.</strong> After a topic call of 10 minutes or more, your partner rates you. Ratings from 5 different partners at 80% or more pass your level.</li>
            </ol>
            <p>Between calls you can chat in writing: your partner fixes a sentence right where you wrote it, and accepted corrections go into your phrasebook. New to this? Read <Link to="/blog/what-is-a-language-exchange">what a language exchange is</Link> and <Link to="/blog/find-a-language-exchange-partner">how to find a good partner</Link>.</p>

            <h2>Already speak {l.name}?</h2>
            <p>Choose {l.name} as your native language and help someone a few steps behind you. Call learners and rate their topic calls, so their level means something. Each correction a learner accepts earns you 5 points, and a bounty answer they accept earns you 50. You can also post {l.name} phrases, idioms, usage notes and grammar tips to the community library.</p>

            <h2>Questions about practising {l.name}</h2>
            <ul>
              <li><strong>Is it free?</strong> Yes. {BRAND} has no paid plans.</li>
              <li><strong>Do I need to be good already?</strong> No. Beginners are welcome: A1 topics start with simple, everyday things.</li>
              <li><strong>Do I have to turn my camera on?</strong> No. You can turn it off at any time, and calls are never recorded.</li>
              <li><strong>Who can correct me?</strong> Native {l.name} speakers, and learners who have passed a higher level than yours.</li>
              <li><strong>Who rates my calls?</strong> Native {l.name} speakers, and learners who have passed a higher level than yours.</li>
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
          <p className="lp-doc__meta"><Link to="/blog">Language learning guides</Link></p>
        </nav>
      </div>
    </PublicShell>
  );
}
