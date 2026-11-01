import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { LANGUAGES, REGIONS } from '@/content/languages';
import '@/styles/landing.css';

/** Every launch language, grouped by region, each linking to its own page. Prerendered to static HTML. */
export default function LanguagesIndex() {
  useSeo({
    title: `Practise ${LANGUAGES.length} Languages with Native Speakers`,
    description: 'Find a language exchange partner for Vietnamese, Swahili, English, French, Spanish, Japanese, Arabic and more. Free, with corrections in every chat.',
    path: '/languages',
  });
  return (
    <PublicShell>
      <div className="lp-wrap">
        <header className="lp-doc__head">
          <p className="lp-kicker">{LANGUAGES.length} languages at launch</p>
          <h1>Languages you can practise</h1>
          <p className="lp-lead lp-blog__lead">Pick the language you speak and the one you are learning. We match you with people who want the opposite, and they correct you inside the chat.</p>
        </header>
        {REGIONS.map((region) => (
          <section key={region} className="lp-langgroup" aria-labelledby={`r-${region}`}>
            <h2 id={`r-${region}`}>{region}</h2>
            <ul>
              {LANGUAGES.filter((l) => l.region === region).map((l) => (
                <li key={l.id}>
                  <Link to={`/languages/${l.slug}`}>
                    <strong>{l.name}</strong>
                    {l.native !== l.name && <span lang={l.lang} dir={l.rtl ? 'rtl' : undefined}>{l.native}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <aside className="lp-doc__contact">
          <p>Ready to practise? It is free.</p>
          <Link className="lp-btn lp-btn--accent" to="/signup">Find a language partner</Link>
        </aside>
      </div>
    </PublicShell>
  );
}
