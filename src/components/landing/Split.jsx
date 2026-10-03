import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C, IMG, wrap, h2, btn, photo } from '../../theme/theme';
import { Reveal } from './Reveal';

const roles = {
  learner: {
    tab: "I'm learning",
    title: 'Practice without pressure',
    body: 'Ask questions, make mistakes and get friendly corrections in the moment.',
    points: ['Matched to your level', 'Corrections in the chat', 'Text, voice or video'],
    cta: 'Join as a learner',
  },
  speaker: {
    tab: 'I speak it well',
    title: 'Share your language',
    body: 'Meet people worldwide and earn rewards for every helpful session.', 
    points: ['Help from anywhere', 'Earn rewards', 'Set your own hours'],
    cta: 'Join as a speaker',
  },
};

export default function Split() {
  const [role, setRole] = useState('learner');
  const r = roles[role];

  return (
    <section id="speakers" style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      {/* Photo + one even frost layer keeps text readable at every width */}
      <div style={{ ...photo(IMG.hero), position: 'absolute', inset: 0, animation: 'ftDrift 22s ease-in-out infinite alternate' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${C.deep}e6 0%, ${C.sky}f2 100%)`, backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(6px)' }} />

      <div style={{ ...wrap, position: 'relative', maxWidth: 760, padding: 'clamp(56px, 9vw, 96px) 24px' }}>
        <Reveal>
          <h2 style={{ ...h2, color: C.white, margin: '0 0 clamp(20px, 3vw, 28px)' }}>Two ways to talk. One place to start.</h2>

          {/* Segmented toggle */}
          <div role="tablist" aria-label="Choose your role" style={{ display: 'inline-flex', padding: 4, gap: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)' }}>
            {Object.entries(roles).map(([key, v]) => {
              const on = key === role;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setRole(key)}
                  style={{ border: 0, cursor: 'pointer', borderRadius: 999, padding: 'clamp(9px, 1.5vw, 11px) clamp(16px, 3vw, 26px)', fontWeight: 800, fontSize: 'clamp(14px, 1.8vw, 16px)', background: on ? C.sun : 'transparent', color: on ? C.ink : C.white, transition: 'background .25s, color .25s' }}
                >
                  {v.tab}
                </button>
              );
            })}
          </div>

          {/* Both panels share one grid cell, so the section never jumps in height */}
          <div style={{ display: 'grid', marginTop: 'clamp(28px, 4vw, 40px)' }}>
            {Object.entries(roles).map(([key, v]) => {
              const on = key === role;
              return (
                <div
                  key={key}
                  role="tabpanel"
                  aria-hidden={!on}
                  style={{ gridArea: '1 / 1', opacity: on ? 1 : 0, transform: on ? 'none' : 'translateY(14px)', pointerEvents: on ? 'auto' : 'none', transition: 'opacity .35s ease, transform .35s ease' }}
                >
                  <h3 style={{ margin: '0 0 10px', fontSize: 'clamp(22px, 3.2vw, 30px)', lineHeight: 1.2, color: C.white }}>{v.title}</h3>
                  <p style={{ margin: '0 auto 20px', maxWidth: 520, fontSize: 'clamp(16px, 2vw, 18px)', lineHeight: 1.65, color: 'rgba(255,255,255,0.88)' }}>{v.body}</p>
                  {/* <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px clamp(14px, 3vw, 26px)', fontWeight: 700, fontSize: 'clamp(14px, 1.7vw, 15px)', color: C.white }}>
                    {v.points.map((p) => (
                      <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.sun, flex: 'none' }} />{p}
                      </li>
                    ))}
                  </ul> */}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'clamp(24px, 4vw, 34px)' }}>
            <Link to={`/signup?role=${role}`} style={btn(C.coral, C.white)}>{r.cta}</Link>
            <p style={{ margin: '16px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
              Already a member? <Link to="/login" style={{ color: C.sun, fontWeight: 800 }}>Log in</Link>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}