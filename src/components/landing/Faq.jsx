import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SUPPORT_SUBJECT } from '@/lib/site';

const faqs = [
  [`Is ${BRAND} free?`, 'Yes. There are no paid plans. You start with 100 points, earn more by helping other people, and spend them on bounties.'],
  ['Do I need to be fluent to join?', 'No. Choose the language you are learning and your level, from A1 to C2. People who speak it natively can correct you.'],
  ['Can I help others with my own language?', 'Yes. Native speakers, and learners at B1 or above, can suggest corrections. Each correction the author accepts earns you 5 points.'],
  ['How are partners matched?', 'By language. Your native language and the one you are learning decide who you see, so the best matches want what you can offer and offer what you want.'],
  ['Is it safe?', 'New contacts arrive as message requests that you can decline. You can block or report anyone, blocked people cannot see you or write to you, and reports are reviewed by admins.'],
  ['Which languages can I practise?', '40 at launch, including Swahili, Vietnamese, English, French, Spanish, German, Arabic, Mandarin and several Kenyan languages. You pick one you speak and one you are learning.'],
];

export default function Faq() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return (
    <section id="faq" className="lp-faq" aria-labelledby="faq-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="lp-wrap lp-faq__grid">
        <div className="lp-faq__head" data-reveal>
          <p className="lp-kicker">Questions</p>
          <h2 id="faq-title">Before you start</h2>
          <p>Something missing? <a className="lp-link" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>Ask us</a>.</p>
        </div>
        <div className="lp-faq__list" data-reveal style={{ '--d': '.1s' }}>
          {faqs.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
      </div>
    </section>
  );
}
