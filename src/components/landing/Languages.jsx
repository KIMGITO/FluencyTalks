import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C, SERIF, wrap, h2, lead, btn, blob } from './theme';
import { Reveal } from './Reveal';
const hellos = [
  ['Hola', C.coral, 'Spanish', '1,240'], ['Bonjour', C.teal, 'French', '980'], ['Habari', C.sun, 'Swahili', '310', true], ['こんにちは', C.indigo, 'Japanese', '760'],
  ['Ciao', C.teal, 'Italian', '420'], ['Hallo', C.coral, 'German', '655'], ['Olá', C.indigo, 'Portuguese', '540'], ['مرحبا', C.sun, 'Arabic', '390', true],
  ['你好', C.coral, 'Mandarin', '870'], ['안녕', C.teal, 'Korean', '510'],
];
export default function Languages() {
  const [lang, setLang] = useState(null);
  return (
    <section id="languages" style={{ background: C.deep, padding: 'clamp(56px, 9vw, 92px) 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={blob(C.coral, 380, { top: -100, right: -80 })} />
      <div style={blob(C.teal, 320, { bottom: -120, left: -80 })} />
      <div style={{ ...wrap, position: 'relative' }}>
        <Reveal>
          <h2 style={{ ...h2, color: C.white }}>Say hello in 40+ languages</h2>
          <p style={{ ...lead, color: 'rgba(255,255,255,0.8)', margin: '0 auto 44px' }}>Tap a greeting to see who is online right now.</p>
        </Reveal>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {hellos.map(([w, c, l, online, dark], i) => (
            <Reveal key={l} delay={i * 0.06}>
              <div className="ft-pop" role="button" tabIndex={0} onClick={() => setLang({ l, online })} onKeyDown={(e) => e.key === 'Enter' && setLang({ l, online })}
                style={{ background: c, color: dark ? C.ink : C.white, padding: 'clamp(10px, 1.6vw, 14px) clamp(16px, 3vw, 26px)', borderRadius: i % 2 ? '28px 28px 28px 6px' : '28px 28px 6px 28px', minWidth: 'clamp(104px, 28vw, 130px)', outline: lang?.l === l ? `3px solid ${C.white}` : 'none', outlineOffset: 3 }}>
                <div style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 3.4vw, 26px)', fontWeight: 700 }}>{w}</div>
                <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{l}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <div style={{ minHeight: 70, marginTop: 36 }}>
          {lang && (
            <div key={lang.l} style={{ animation: 'ftUp .5s both', color: C.white, fontSize: 18 }}>
              <b style={{ color: C.sun }}>{lang.online}</b> {lang.l} speakers are online now.{' '}
              <Link to="/signup" style={btn(C.sun, C.ink, { padding: '10px 22px', marginLeft: 10 })}>Practice {lang.l}</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
