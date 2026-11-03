import { Link } from 'react-router-dom';
import { useFaqs } from '@/hooks/useFaqs';
import { BLOG_MARK, faqHomeHtml } from '@/lib/blogHtml';
import { EMAILS, mailto } from '@/lib/emails';
import { SUPPORT_SUBJECT } from '@/lib/site';

export default function Faq() {
  const { faqs } = useFaqs('/');
  const ssr = typeof document === 'undefined';
  return (
    <section id="faq" className="lp-faq" aria-labelledby="faq-title">
      <div className="lp-wrap lp-faq__grid">
         <div className="lp-faq__head" data-reveal>
          <p className="lp-kicker">Questions</p>
          <h2 id="faq-title">Before you start ...</h2>
        </div>
        <div className="lp-faq__list" data-reveal style={{ '--d': '.1s' }} dangerouslySetInnerHTML={{ __html: ssr ? BLOG_MARK : faqHomeHtml(faqs ?? []) }} />
        <div className="lp-faq__head" data-reveal>
          <p>More detail on points, bounties and corrections in <Link className="lp-link" to="/faq">the full FAQ</Link>.</p>
          <p>New to this? Read <Link className="lp-link" to="/blog/what-is-a-language-exchange">what a language exchange is</Link>.</p>
          <p>Something missing? <a className="lp-link" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>Ask us</a>.</p>
        </div>
      </div>
    </section>
  );
}
