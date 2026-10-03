import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C, DISPLAY, FONT, wrap, h2, lead, btn, blob } from '../../theme/theme';
import { Reveal } from './Reveal';

const hellos = [
  ['Hola', C.coral, 'Spanish', '1,240'],
  ['Bonjour', C.teal, 'French', '980'],
  ['Habari', C.sun, 'Swahili', '310', true],
  ['こんにちは', C.indigo, 'Japanese', '760'],
  ['Ciao', C.teal, 'Italian', '420'],
  ['Hallo', C.coral, 'German', '655'],
  ['Olá', C.indigo, 'Portuguese', '540'],
  ['مرحبا', C.sun, 'Arabic', '390', true],
  ['你好', C.coral, 'Mandarin', '870'],
  ['안녕', C.teal, 'Korean', '510'],
];

const CSS = `
.ft-lang-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  align-items: stretch;
  max-width: 960px;
  margin: 0 auto;
}

.ft-lang-pill {
  position: relative;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.22s ease,
              outline 0.15s ease;
}

/* Hover effect on desktop */
@media (hover: hover) {
  .ft-lang-pill:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
  }
}

/* Tactile touch feedback on mobile tap */
.ft-lang-pill:active {
  transform: scale(0.95) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}

/* Active state selection */
.ft-lang-pill.is-active {
  outline: 3px solid ${C.white};
  outline-offset: 3px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.ft-online-banner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${C.white};
  font-family: ${FONT};
  font-size: 18px;
  animation: ftUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* 3-Column Layout & Scaled Sizing for Mobile Screens */
@media (max-width: 640px) {
  .ft-lang-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 0 4px;
  }

  .ft-lang-pill {
    min-width: 0 !important;
    padding: 10px 4px !important;
  }

  .ft-lang-word {
    font-size: clamp(14px, 4vw, 18px) !important;
    line-height: 1.15 !important;
  }

  .ft-lang-sub {
    font-size: 10px !important;
    margin-top: 2px !important;
    letter-spacing: 0.02em !important;
  }

  .ft-online-banner {
    flex-direction: column;
    gap: 12px;
    font-size: 15px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    width: 100%;
    box-sizing: border-box;
  }

  .ft-online-banner a {
    margin-left: 0 !important;
    width: 100%;
    text-align: center;
    box-sizing: border-box;
  }
}
`;

export default function Languages() {
  const [lang, setLang] = useState(null);

  return (
    <section
      id="languages"
      style={{
        background: C.deep,
        padding: 'clamp(56px, 9vw, 92px) 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>
      <div style={blob(C.coral, 380, { top: -100, right: -80 })} />
      <div style={blob(C.teal, 320, { bottom: -120, left: -80 })} />

      <div style={{ ...wrap, position: 'relative' }}>
        <Reveal>
          <h2 style={{ ...h2, color: C.white }}>Say hello in 40+ languages</h2>
          <p
            style={{
              ...lead,
              color: 'rgba(255,255,255,0.8)',
              margin: '0 auto clamp(28px, 5vw, 44px)',
            }}
          >
            Tap a greeting to see who is online right now.
          </p>
        </Reveal>

        <div className="ft-lang-grid">
          {hellos.map(([word, color, name, online, dark], i) => {
            const isActive = lang?.l === name;
            return (
              <Reveal key={name} delay={i * 0.03}>
                <div
                  className={`ft-lang-pill ${isActive ? 'is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLang({ l: name, online })}
                  onKeyDown={(e) => e.key === 'Enter' && setLang({ l: name, online })}
                  style={{
                    background: color,
                    color: dark ? C.ink : C.white,
                    padding: 'clamp(10px, 1.6vw, 14px) clamp(16px, 3vw, 26px)',
                    borderRadius: i % 2 ? '28px 28px 28px 6px' : '28px 28px 6px 28px',
                    minWidth: 'clamp(104px, 24vw, 130px)',
                  }}
                >
                  <div
                    className="ft-lang-word"
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 'clamp(20px, 3.2vw, 26px)',
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {word}
                  </div>
                  <div
                    className="ft-lang-sub"
                    style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      fontWeight: 700,
                      opacity: 0.88,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {name}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div style={{ minHeight: 80, marginTop: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {lang && (
            <div key={lang.l} className="flex flex-col gap-4">
              <span style={{color: C.white}}>
                <b style={{ color: C.sun, fontSize: '1.1em' }}>{lang.online}</b> {lang.l} speakers are online now.
              </span>
              <Link
                to="/signup"
                style={btn(C.sun, C.ink, {
                  padding: '10px 22px',
                  marginLeft: 12,
                  boxShadow: '0 4px 14px rgba(255,200,61,0.3)',
                })}
              >
                Practice {lang.l}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}