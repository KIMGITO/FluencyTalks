import { Link } from 'react-router-dom';
import { EMAILS, mailto } from '@/lib/emails';
import { LANDING_FAQS } from '@/content/faq';
import { SUPPORT_SUBJECT } from '@/lib/site';

export default function Faq() {
  return (
    <section id="faq" className="lp-faq" aria-labelledby="faq-title">
      <div className="lp-wrap lp-faq__grid">
         <div className="lp-faq__head" data-reveal>
          <p className="lp-kicker">Questions</p>
          <h2 id="faq-title">Before you start ...</h2>
        </div>
        <div className="lp-faq__list" data-reveal style={{ '--d': '.1s' }}>
          {LANDING_FAQS.map(({ q, a }) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
        <div className="lp-faq__head" data-reveal>
          <p>More detail on points, bounties and corrections in <Link className="lp-link" to="/faq">the full FAQ</Link>.</p>
          <p>New to this? Read <Link className="lp-link" to="/blog/what-is-a-language-exchange">what a language exchange is</Link>.</p>
          <p>Something missing? <a className="lp-link" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>Ask us</a>.</p>
        </div>
      </div>
    </section>
  );
}
