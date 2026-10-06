import { C, wrap, h2, lead, blob } from '../../theme/theme';
import { howItWorksCSS } from '../../theme/componentStyles';
import { Reveal } from './Reveal';
import { Languages, Users, MessagesSquare, BookmarkCheck } from 'lucide-react';

const steps = [
  {
    kicker: 'Step 1',
    title: 'Pick your language',
    body: 'Choose what you are learning and your level, from first words to fluent debate.',
    accent: C.indigo,
    Icon: Languages,
  },
  {
    kicker: 'Step 2',
    title: 'Meet a speaker',
    body: 'We match you with native and fluent speakers who share your interests.',
    accent: C.teal,
    Icon: Users,
  },
  {
    kicker: 'Step 3',
    title: 'Get corrected',
    body: 'Chat by text and get friendly corrections in the moment.',
    accent: C.coral,
    Icon: MessagesSquare,
  },
  {
    kicker: 'Step 4',
    title: 'Save and repeat',
    body: 'Keep useful phrases, track your streak, and build daily habits effortlessly.',
    accent: C.sun,
    Icon: BookmarkCheck,
    darkIcon: true,
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how"
      style={{
        background: C.surface,
        padding: 'clamp(56px, 9vw, 96px) 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{howItWorksCSS}</style>
      {/* Same drifting wash used in Languages — ties the two light/dark bands together */}
      <div aria-hidden="true" style={blob(C.coral, 340, { top: -120, right: -90, opacity: 0.16 })} />
      <div aria-hidden="true" style={blob(C.teal, 300, { bottom: -130, left: -90, opacity: 0.16 })} />

      <div style={{ ...wrap, position: 'relative' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 60px)' }}>
            <h2 style={{ ...h2, textAlign: 'center', marginTop: 16 }}>
              Your first conversation in four steps
            </h2>
            <p style={{ ...lead, margin: '0 auto', textAlign: 'center' }}>
              Most members are chatting naturally within five minutes of signing up.
            </p>
          </div>
        </Reveal>

        <div className="ft-steps-container">
          <ol className="ft-steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {steps.map((step, i) => (
              <li key={step.title} style={{ height: '100%' }}>
                <Reveal delay={i * 0.08} style={{ height: '100%' }}>
                  <article
                    className="ft-step-card"
                    style={{ '--ft-accent': step.accent }}
                  >
                    <div className="ft-step-top">
                      <span
                        className="ft-step-icon"
                        style={{
                          background: step.accent,
                          color: step.darkIcon ? C.ink : C.white,
                        }}
                      >
                        <step.Icon size={22} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      <span className="ft-step-kicker">{step.kicker}</span>
                    </div>
                    <h3 className="ft-step-title">{step.title}</h3>
                    <p className="ft-step-body">{step.body}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}