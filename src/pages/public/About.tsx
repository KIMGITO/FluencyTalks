import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SITE_URL, SITE_URL_WITH_SLASH, SUPPORT_SUBJECT } from '@/lib/site';
import { LANGUAGES } from '@/content/languages';
import '@/styles/landing.css';

/** Who built it and why: a trust page for people, Google and AI assistants. Only true statements. */
export default function About() {
  useSeo({
    title: `About ${BRAND}: Who We Are`,
    description: `${BRAND} is a free language exchange in ${LANGUAGES.length} languages, with corrections inside the chat. Why we built it and how to reach us.`,
    path: '/about',
  });
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'AboutPage', url: `${SITE_URL}/about`, name: `About ${BRAND}`,
    mainEntity: { '@type': 'Organization', name: BRAND, url: SITE_URL_WITH_SLASH, logo: `${SITE_URL}/favicon.png`, email: EMAILS.support },
  };
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="lp-wrap">
        <article className="lp-article">
          <header className="lp-doc__head">
            <p className="lp-kicker">About us</p>
            <h1>About {BRAND}</h1>
          </header>
          <p className="lp-article__summary">{BRAND} is a free language exchange. You chat with people who speak the language you are learning, they correct your messages right inside the conversation, and you keep every correction in your own phrasebook.</p>

          <dl className="lp-langfacts">
            <div><dt>Languages</dt><dd>{LANGUAGES.length} at launch</dd></div>
            <div><dt>Cost</dt><dd>Free, no paid plans</dd></div>
            <div><dt>Levels</dt><dd>A1 to C2</dd></div>
          </dl>

          <div className="lp-article__body">
            <h2>Why we built it</h2>
            <p>Apps teach you words. People teach you to talk. Flashcards only go so far: fluency comes from real conversations with someone patient, curious and glad to help. We wanted a place built entirely around that conversation, with no followers, no likes and no popularity contest.</p>
            <p>We also wanted the moment of correction to be useful. On most chat apps a correction is a message that scrolls away. Here, your partner edits your sentence where you wrote it, you see exactly what changed, and the phrase is saved for you to review.</p>

            <h2>Who we are</h2>
            <p>We build and run {BRAND} for people who want to practise a language with other people. If something breaks or you have an idea, tell us.</p>

            <h2>What we care about</h2>
            <ul>
              <li><strong>Languages that are often left out.</strong> Alongside English, French, Spanish and Japanese, you can practise Vietnamese, Swahili, Amharic, Yoruba, Igbo, Hausa, Zulu, Tagalog and more. See <Link to="/languages">all {LANGUAGES.length} languages</Link>.</li>
              <li><strong>Helping is rewarded.</strong> Every accepted correction earns the helper points, and anyone stuck can post a bounty.</li>
              <li><strong>Safety.</strong> New contacts arrive as requests you can decline. You can block or report anyone, and reports are reviewed by admins.</li>
              <li><strong>Your data is yours.</strong> We do not sell it, and you can export or delete it at any time. Read our <Link to="/privacy">privacy policy</Link>.</li>
            </ul>

            <h2>Contact</h2>
            <p>Questions, ideas or something broken? Write to <a href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>{EMAILS.support}</a>. For privacy requests, write to <a href={mailto(EMAILS.privacy)}>{EMAILS.privacy}</a>.</p>
            <p>Want to know more first? Read <Link to="/blog/what-is-a-language-exchange">what a language exchange is</Link>, or browse the <Link to="/blog">learning guides</Link>.</p>
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
