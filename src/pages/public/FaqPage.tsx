import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useFaqs } from '@/hooks/useFaqs';
import { useSeo } from '@/hooks/useSeo';
import { BLOG_MARK, faqPageHtml } from '@/lib/blogHtml';
import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SUPPORT_SUBJECT } from '@/lib/site';
import '@/styles/landing.css';

/** How it works, as questions and answers. Staff edit them in /admin/faq, and worker/index.ts puts them in the page on the server. */
export default function FaqPage() {
  useSeo({
    title: `How ${BRAND} Works: FAQ`,
    description: 'How one-to-one language practice, chat corrections, points and bounties work on our free language exchange, in short and direct answers.',
    path: '/faq',
  });
  const { faqs, failed } = useFaqs('/faq');
  const ssr = typeof document === 'undefined';

  return (
    <PublicShell>
      <div className="lp-wrap">
        <article className="lp-article">
          <header className="lp-doc__head">
            <nav aria-label="Breadcrumb" className="lp-crumbs"><Link to="/">Home</Link></nav>
            <p className="lp-kicker">Questions and answers</p>
            <h1>How {BRAND} works</h1>
          </header>
          <p className="lp-article__summary">{BRAND} is a free language exchange. You chat one to one with people who speak the language you are learning, and they correct your messages inside the conversation.</p>

          <div className="lp-article__body">
            {!ssr && !faqs && <p className="lp-blog__note" role={failed ? 'alert' : 'status'}>{failed ? "We couldn't load the questions. Please refresh the page to try again." : 'Loading the questions…'}</p>}
            {(ssr || faqs) && <div dangerouslySetInnerHTML={{ __html: ssr ? BLOG_MARK : faqPageHtml(faqs ?? []) }} />}
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
