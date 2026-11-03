import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { FAQ_GROUPS } from '@/content/faq';
import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SITE_URL, SITE_URL_WITH_SLASH, SUPPORT_SUBJECT } from '@/lib/site';
import '@/styles/landing.css';

/** How it works, as questions and answers. Every answer is open in the HTML: nothing is hidden behind a click or a login. */
export default function FaqPage() {
  useSeo({
    title: `How ${BRAND} Works: FAQ`,
    description: 'How one-to-one language practice, chat corrections, points and bounties work on our free language exchange, in short and direct answers.',
    path: '/faq',
  });
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'FAQPage', url: `${SITE_URL}/faq`,
      mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL_WITH_SLASH },
        { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${SITE_URL}/faq` },
      ],
    },
  ];

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="lp-wrap">
        <article className="lp-article">
          <header className="lp-doc__head">
            <nav aria-label="Breadcrumb" className="lp-crumbs"><Link to="/">Home</Link></nav>
            <p className="lp-kicker">Questions and answers</p>
            <h1>How {BRAND} works</h1>
          </header>
          <p className="lp-article__summary">{BRAND} is a free language exchange. You chat one to one with people who speak the language you are learning, and they correct your messages inside the conversation.</p>

          <div className="lp-article__body">
            {FAQ_GROUPS.map((g) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`}>
                <h2 id={`${g.id}-title`}>{g.title}</h2>
                {g.items.map(({ q, a }) => (
                  <div key={q}>
                    <h3>{q}</h3>
                    <p>{a}</p>
                  </div>
                ))}
              </section>
            ))}
            <h2>Still have a question?</h2>
            <p>Read <Link to="/blog/what-is-a-language-exchange">what a language exchange is</Link>, browse <Link to="/languages">all the languages you can practise</Link>, or write to <a href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>{EMAILS.support}</a>.</p>
          </div>

          <aside className="lp-doc__contact">
            <p>Ready for your first conversation?</p>
            <Link className="lp-btn lp-btn--accent" to="/signup">Create your free account</Link>
          </aside>
        </article>
      </div>
    </PublicShell>
  );
}
