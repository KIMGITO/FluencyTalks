import { Link } from 'react-router-dom';
import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SUPPORT_SUBJECT } from '@/lib/site';

const faqs = [
  ['What is a language exchange?', `Two people who speak different languages help each other practise. For example, you speak English and are learning Vietnamese, and your partner speaks Vietnamese and is learning English. On ${BRAND} you chat in writing and correct each other's messages.`],
  [`Is ${BRAND} free?`, 'Yes. There are no paid plans. You start with 100 points, earn 5 for each correction someone accepts, and spend 50 on a bounty when you are stuck.'],
  [`How is ${BRAND} different from other language exchange apps?`, 'Corrections are built into the chat and saved to your phrasebook, you are matched by language rather than popularity, there are no followers or likes, and it is free with no paid tier.'],
  ['Do I need to be fluent to join?', 'No. Choose the language you are learning and your level, from A1 to C2. People who speak it natively, or have been verified at B1 or above, can correct you.'],
  ['Can I help others with my own language?', 'Yes. Native speakers, and learners verified at B1 or above through their practice, can suggest corrections. Each correction the author accepts earns you 5 points.'],
  ['How are partners matched?', 'By language. Your native language and the one you are learning decide who you see. If you speak English and are learning Vietnamese, your matches are native Vietnamese speakers and people learning English whom you can help, ahead of everyone else.'],
  ['Do I have to speak on video?', 'No. Practice happens in text chat, so you can take your time and see every correction written out.'],
  ['Is it safe?', 'New contacts arrive as message requests that you can decline. You can block or report anyone, blocked people cannot see you or write to you, and reports are reviewed by admins.'],
  ['Which languages can I practise?', '40 at launch: English, Vietnamese, Swahili, Spanish, French, German, Portuguese, Italian, Chinese, Cantonese, Japanese, Korean, Hindi, Arabic, Russian, Turkish and 24 more. You pick one you speak and one you are learning.'],
  ['Can I practise Vietnamese with native speakers for free?', 'Yes. Choose Vietnamese as the language you are learning. Native Vietnamese speakers are suggested to you as matches, and you can help any of them who are learning English in return.'],
  ['Can I translate a message I do not understand?', 'Yes. Open any message’s menu and choose Translate message. Every translation is kept on your Learning page, next to your saved phrases and the corrections you received.'],
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
          <h2 id="faq-title">Before you start ...</h2>
        </div>
        <div className="lp-faq__list" data-reveal style={{ '--d': '.1s' }}>
          {faqs.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
        <div className="lp-faq__head" data-reveal>
          <p>New to this? Read <Link className="lp-link" to="/blog/what-is-a-language-exchange">what a language exchange is</Link>.</p>
          <p>Something missing? <a className="lp-link" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>Ask us</a>.</p>
        </div>
      </div>
    </section>
  );
}
