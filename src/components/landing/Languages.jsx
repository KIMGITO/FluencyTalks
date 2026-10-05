import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C, DISPLAY, FONT, wrap, h2, lead, btn, blob } from '../../theme/theme';
import { languagesCSS } from '../../theme/componentStyles';
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
      <style>{languagesCSS}</style>
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