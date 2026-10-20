import { C, wrap, h2 } from '../../theme/theme';
import { Reveal } from './Reveal';
import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SUPPORT_SUBJECT } from '@/lib/site';
const faqs = [
  [
    `Is ${BRAND} free?`,
    'You can sign up and start chatting for free. Premium adds voice and video sessions and unlimited matches.',
  ],
  [
    'Do I need to be fluent to join?',
    'No. Beginners are welcome, and partners adjust their pace to your level.',
  ],
  [
    'Can I teach my own language in return?',
    'Yes. Many members swap, so you practice theirs and help with yours.',
  ],
  [
    'Is it safe?',
    'Every profile is moderated, and you can block or report anyone with one tap.',
  ],
];
export default function Faq() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return (
    <section
      id="faq"
      itemScope
      itemType="https://schema.org/FAQPage"
      style={{ padding: 'clamp(52px, 8vw, 80px) 0 clamp(56px, 8vw, 90px)' }}
    >
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <div style={{ ...wrap, maxWidth: 820 }}>
        <Reveal>
          <h2 style={{ ...h2, textAlign: 'center', marginBottom: 32 }}>
            Questions, answered
          </h2>
        </Reveal>
        {faqs.map(([q, a], i) => (
          <Reveal key={q} delay={i * 0.1}>
            <details
              style={{
                borderBottom: `2px solid ${C.indigo}`,
                padding: '18px 4px',
              }}
            >
              <summary
                style={{
                  fontWeight: 800,
                  fontSize: 'clamp(16px, 2vw, 18px)',
                  cursor: 'pointer',
                }}
              >
                {q}
              </summary>
              <p style={{ margin: '10px 0 0', color: C.muted }}>{a}</p>
            </details>
          </Reveal>
        ))}
        <Reveal delay={faqs.length * 0.1}>
          <p style={{ margin: '22px 0 0', color: C.muted }}>
            Still stuck? Email us{' '}
            <a href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>
              {EMAILS.support}
            </a>{' '}
            or write to{' '}
            <a href={mailto(EMAILS.info, { subject: 'General question' })}>
              {EMAILS.info}
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
