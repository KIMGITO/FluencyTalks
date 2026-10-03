import { C, DISPLAY, FONT, wrap, h2, lead } from '../../theme/theme';
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
    title: 'Talk and get corrected',
    body: 'Chat by text, voice or video. Mistakes are fixed naturally as you go.',
    accent: C.coral,
  },
  {
    title: 'Save and repeat',
    body: 'Keep useful phrases, track your streak, and build daily habits effortlessly.',
    accent: C.sun,
  },
];

/* Clean, modern, vertical-to-horizontal responsive timeline CSS */
const CSS = `
.ft-steps-container {
  position: relative;
}

.ft-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(20px, 2.5vw, 36px);
  position: relative;
  z-index: 1;
}

.ft-step-card {
  position: relative;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  padding: clamp(20px, 2vw, 24px);
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), 
              box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.35s ease;
  box-shadow: 0 4px 20px rgba(23, 22, 58, 0.04);
}

.ft-step-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 36px rgba(23, 22, 58, 0.1);
  border-color: rgba(255, 106, 77, 0.3);
  background: #ffffff;
}

.ft-step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  position: relative;
}

.ft-num {
  flex: none;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: ${C.indigo};
  color: ${C.white};
  font-family: ${DISPLAY};
  font-size: 20px;
  font-weight: 800;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
              background-color 0.3s ease, 
              box-shadow 0.3s ease;
  box-shadow: 0 6px 16px rgba(43, 42, 122, 0.25);
}

.ft-step-card:hover .ft-num {
  background: ${C.coral};
  color: ${C.white};
  transform: scale(1.1) rotate(-4deg);
  box-shadow: 0 8px 20px rgba(255, 106, 77, 0.35);
}

/* Horizontal connecting line (Desktop) */
.ft-step-connector {
  flex: 1;
  height: 3px;
  margin-right: calc(-1 * (clamp(20px, 2.5vw, 36px) + clamp(20px, 2vw, 24px)));
  background: linear-gradient(90deg, rgba(43, 42, 122, 0.3) 0%, rgba(43, 42, 122, 0.05) 100%);
  border-radius: 99px;
  transform-origin: left center;
  transition: background 0.3s ease;
}

.ft-step-card:hover .ft-step-connector {
  background: linear-gradient(90deg, ${C.coral} 0%, rgba(255, 106, 77, 0.1) 100%);
}

.ft-step-title {
  font-family: ${DISPLAY};
  font-size: clamp(18px, 1.8vw, 21px);
  font-weight: 800;
  line-height: 1.25;
  color: ${C.ink};
  margin: 0 0 10px;
  letter-spacing: -0.02em;
}

.ft-step-body {
  font-family: ${FONT};
  font-size: clamp(14px, 1.5vw, 15px);
  line-height: 1.6;
  color: ${C.muted};
  margin: 0;
}

/* Tablet Layout (2 x 2 Grid) */
@media (max-width: 1024px) and (min-width: 641px) {
  .ft-steps {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
  .ft-step-connector {
    display: none;
  }
}

/* Mobile Layout (Vertical Timeline Card Stack) */
@media (max-width: 640px) {
  .ft-steps {
    grid-template-columns: 1fr;
    gap: 16px;
    max-width: 480px;
    margin: 0 auto;
  }

  .ft-step-connector {
    display: none;
  }

  .ft-step-card {
    padding: 20px;
    border-radius: 18px;
  }

  .ft-step-header {
    margin-bottom: 14px;
  }

  .ft-num {
    width: 42px;
    height: 42px;
    font-size: 18px;
    border-radius: 14px;
  }
}
`;

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
      <style>{CSS}</style>
      <div style={wrap}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 64px)' }}>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: C.coral,
                background: C.blush,
                padding: '6px 14px',
                borderRadius: 999,
                display: 'inline-block',
                marginBottom: 12,
              }}
            >
              Simple Process
            </span>
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