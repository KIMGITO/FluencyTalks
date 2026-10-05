import { C, wrap, h2, lead } from '../../theme/theme';
import { howItWorksCSS } from '../../theme/componentStyles';
import { Reveal } from './Reveal';

const steps = [
  {
    title: 'Pick your language',
    body: 'Choose what you are learning and your level, from first words to fluent debate.',
    accent: C.indigo,
  },
  {
    title: 'Meet a speaker',
    body: 'We match you with native and fluent speakers who share your interests.',
    accent: C.teal,
  },
  {
    title: ' Get corrected',
    body: 'Chat by text and get friendly corrections in the moment.',
    accent: C.coral,
  },
  {
    title: 'Save and repeat',
    body: 'Keep useful phrases, track your streak, and build daily habits effortlessly.',
    accent: C.sun,
  },
];


export default function HowItWorks() {
  return (
    <section
      id="how"
      style={{
        background: C.sky,
        padding: 'clamp(56px, 9vw, 96px) 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{howItWorksCSS}</style>
      <div style={wrap}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 64px)' }}>
            <h2 style={{ ...h2, textAlign: 'center' }}>
              Your first conversation in four steps
            </h2>
            <p
              style={{
                ...lead,
                margin: '0 auto',
                textAlign: 'center',
                font:'initial'
              }}
            >
              Most members are chatting naturally within five minutes of signing up.
            </p>
          </div>
        </Reveal>

        <div className="ft-steps-container">
          <ol
            className="ft-steps"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {steps.map((step, i) => (
              <li key={step.title} style={{ height: '100%' }}>
                <Reveal delay={i * 0.1}>
                  <div className="ft-step-card">
                    <div className="ft-step-header">
                      <span className="ft-num" aria-hidden="true">
                        0{i + 1}
                      </span>
                      {i < steps.length - 1 && (
                        <span className="ft-step-connector" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <h3 className="ft-step-title">{step.title}</h3>
                      <p className="ft-step-body">{step.body}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}