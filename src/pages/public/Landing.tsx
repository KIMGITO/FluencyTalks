import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* ---------- Tokens ---------- */
const NAME = 'FluencyTalks';
const C = { indigo: '#2b2a7a', deep: '#1b1a55', coral: '#ff6a4d', teal: '#12b5a6', sun: '#ffc83d', sky: '#e6f4ff', blush: '#fff0ea', ink: '#17163a', muted: '#5b5a7e', white: '#fff' };
const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const img = (id, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=75`;
const IMG = {
  hero: img('photo-1543269865-cbf427effbad', 1600), friends: img('photo-1529156069898-49953e39b3ac'),
  team: img('photo-1522071820081-009f0129c71c'), online: img('photo-1516321318423-f06f85e504b3', 1600), talk: img('photo-1517048676732-d65bc937f952', 1600),
};

/* Keyframes, hover states and media queries cannot be written inline, so they live in this one block. */
const CSS = `
html{scroll-behavior:smooth}
@keyframes ftWord{from{opacity:0;transform:translateY(70%) rotate(5deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes ftUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes ftZoom{from{transform:scale(1)}to{transform:scale(1.14)}}
@keyframes ftFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
@keyframes ftFill{from{width:0}to{width:100%}}
a[style*="999px"]{transition:transform .25s,box-shadow .25s}
a[style*="999px"]:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(0,0,0,.28)}
.ft-pop{transition:transform .3s cubic-bezier(.3,1.6,.5,1),box-shadow .3s;cursor:pointer}
.ft-pop:hover{transform:translateY(-8px) rotate(-2deg) scale(1.06);box-shadow:0 14px 28px rgba(0,0,0,.35)}
.ft-lift{transition:transform .3s}.ft-lift:hover{transform:translateY(-8px)}
.ft-img{transition:transform 1.4s cubic-bezier(.2,.8,.2,1)}.ft-img:hover{transform:scale(1.05)}
.ft-nav a{position:relative}.ft-nav a:after{content:'';position:absolute;left:0;bottom:-5px;height:3px;width:0;background:#ff6a4d;transition:width .25s}.ft-nav a:hover:after{width:100%}
.ft-arrow{transition:background .25s,transform .25s}.ft-arrow:hover{background:#ffc83d!important;color:#17163a!important;transform:scale(1.1)}
details summary{transition:color .2s}details summary:hover{color:#ff6a4d}
@media(max-width:800px){.ft-bub{display:none}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

/* ---------- Style helpers ---------- */
const wrap = { maxWidth: 1160, margin: '0 auto', padding: '0 24px' };
const h2 = { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.15, margin: '0 0 14px', color: C.ink };
const lead = { fontSize: 18, lineHeight: 1.65, color: C.muted, maxWidth: 560, margin: 0 };
const btn = (bg, color, extra = {}) => ({ display: 'inline-block', background: bg, color, padding: '14px 30px', borderRadius: 999, fontWeight: 800, fontSize: 16, textDecoration: 'none', border: '2px solid transparent', ...extra });
const photo = (src, extra = {}) => ({ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', ...extra });
const grid = (min, gap = 28) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap });
/* Fades an image edge into the page so photo and text blend together */
const fade = (dir) => { const m = `linear-gradient(${dir}, #000 52%, transparent 100%)`; return { WebkitMaskImage: m, maskImage: m }; };
const blob = (color, size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, filter: 'blur(70px)', opacity: 0.35, animation: 'ftFloat 9s ease-in-out infinite', pointerEvents: 'none', ...pos });

/* ---------- Hooks and small components ---------- */
function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setSeen(true); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); o.disconnect(); } }, { threshold: 0.15 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, seen];
}

function Reveal({ children, delay = 0, from = 'up', style }) {
  const [ref, seen] = useInView();
  const t = { up: 'translateY(44px)', left: 'translateX(-60px)', right: 'translateX(60px)' }[from];
  return (
    <div ref={ref} style={{ opacity: seen ? 1 : 0, transform: seen ? 'none' : t, transition: `opacity .9s ${delay}s ease, transform .9s ${delay}s cubic-bezier(.2,.8,.2,1)`, ...style }}>
      {children}
    </div>
  );
}

function Count({ to, suffix = '', dec = 0 }) {
  const [ref, seen] = useInView();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let s;
    const f = (t) => { s = s || t; const p = Math.min((t - s) / 1600, 1); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, [seen, to]);
  return <span ref={ref}>{v.toFixed(dec)}{suffix}</span>;
}

const Words = ({ text, on }) => text.split(' ').map((w, i) => (
  <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: 8 }}>
    <span style={{ display: 'inline-block', marginRight: '0.28em', opacity: on ? undefined : 0, animation: on ? `ftWord .8s ${0.2 + i * 0.09}s cubic-bezier(.2,.8,.2,1) both` : 'none' }}>{w}</span>
  </span>
));

function Logo({ light }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <span style={{ width: 38, height: 38, borderRadius: '50% 50% 50% 8px', background: `linear-gradient(135deg, ${C.coral}, ${C.sun})`, display: 'grid', placeItems: 'center', fontWeight: 900, color: C.white, fontSize: 20 }}>F</span>
      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: light ? C.white : C.indigo }}>{NAME}</span>
    </Link>
  );
}

const bubble = (bg, color, extra) => ({ position: 'absolute', background: bg, color, padding: '12px 20px', borderRadius: '22px 22px 22px 4px', fontWeight: 800, fontSize: 18, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'ftFloat 5s ease-in-out infinite', ...extra });

/* ---------- Content ---------- */
const nav = [['How it works', '#how'], ['Languages', '#languages'], ['For speakers', '#speakers'], ['Stories', '#stories'], ['FAQ', '#faq']];
const slides = [
  { img: IMG.hero, tag: 'Real conversation. Real people.', title: 'Speak a new language with the people who speak it.', sub: 'Friendly one-to-one practice with native and fluent speakers, matched to your level.' },
  { img: IMG.talk, tag: 'Learn in the moment', title: 'Get corrected while you chat, not after you quit.', sub: 'Your partner fixes mistakes right in the conversation, so the right form sticks.' },
  { img: IMG.online, tag: 'Any time, anywhere', title: 'Practice 40 languages from your own sofa.', sub: 'Text, voice or video. Drop in for ten minutes or stay for an hour.' },
];
const stats = [[40, '+', 0, 'Languages to practice'], [120, 'k', 0, 'Conversations a month'], [85, '', 0, 'Countries represented'], [4.8, '/5', 1, 'Average session rating']];
const steps = [
  ['Pick your language', 'Choose what you are learning and your level, from first words to fluent debate.', C.coral],
  ['Meet a speaker', 'We match you with native and fluent speakers who share your interests.', C.teal],
  ['Talk and get corrected', 'Chat by text, voice or video. Mistakes are fixed as you go.', C.sun],
  ['Save and repeat', 'Keep useful phrases, track your streak and come back tomorrow.', C.indigo],
];
const hellos = [
  ['Hola', C.coral, 'Spanish', '1,240'], ['Bonjour', C.teal, 'French', '980'], ['Habari', C.sun, 'Swahili', '310', true], ['こんにちは', C.indigo, 'Japanese', '760'],
  ['Ciao', C.teal, 'Italian', '420'], ['Hallo', C.coral, 'German', '655'], ['Olá', C.indigo, 'Portuguese', '540'], ['مرحبا', C.sun, 'Arabic', '390', true],
  ['你好', C.coral, 'Mandarin', '870'], ['안녕', C.teal, 'Korean', '510'],
];
const faqs = [
  ['Is FluencyTalks free?', 'You can sign up and start chatting for free. Premium adds voice and video sessions and unlimited matches.'],
  ['Do I need to be fluent to join?', 'No. Beginners are welcome, and partners adjust their pace to your level.'],
  ['Can I teach my own language in return?', 'Yes. Many members swap, so you practice theirs and help with yours.'],
  ['Is it safe?', 'Every profile is moderated, and you can block or report anyone with one tap.'],
];

export default function Landing() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lang, setLang] = useState(null);
  const [sp, setSp] = useState(0);
  const n = slides.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), 6500);
    return () => clearTimeout(t);
  }, [idx, paused, n]);

  useEffect(() => {
    const f = () => { const h = document.documentElement; setSp(h.scrollTop / ((h.scrollHeight - h.clientHeight) || 1)); };
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  const go = (d) => setIdx((i) => (i + d + n) % n);
  const arrow = { width: 46, height: 46, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.12)', color: C.white, fontSize: 20, cursor: 'pointer', fontWeight: 800 };

  return (
    <div style={{ fontFamily: FONT, color: C.ink, background: C.white, lineHeight: 1.5, overflowX: 'hidden' }}>
      <style>{CSS}</style>
      <div style={{ position: 'fixed', top: 0, left: 0, height: 4, width: `${sp * 100}%`, background: `linear-gradient(90deg, ${C.coral}, ${C.sun}, ${C.teal})`, zIndex: 30 }} />

      <div style={{ background: C.coral, color: C.white, textAlign: 'center', padding: '10px 16px', fontSize: 14, fontWeight: 700 }}>
        New: free 15-minute voice rooms every evening. Drop in and say hello.
      </div>

      <header style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 20, boxShadow: sp > 0.01 ? '0 6px 24px rgba(43,42,122,0.15)' : '0 2px 0 rgba(43,42,122,0.08)', transition: 'box-shadow .3s' }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 24px' }}>
          <Logo />
          <nav className="ft-nav" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontWeight: 700, fontSize: 15 }}>
            {nav.map(([l, h]) => <a key={l} href={h} style={{ color: C.ink, textDecoration: 'none' }}>{l}</a>)}
          </nav>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login" style={btn('transparent', C.indigo, { padding: '10px 20px', borderColor: C.indigo })}>Log in</Link>
            <Link to="/signup" style={btn(C.indigo, C.white, { padding: '10px 22px' })}>Sign up free</Link>
          </div>
        </div>
      </header>

      {/* Hero carousel: backgrounds and words slide together */}
      <section onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ position: 'relative', overflow: 'hidden', borderRadius: '0 0 0 120px', background: C.deep }}>
        <div style={{ display: 'flex', width: `${n * 100}%`, transform: `translateX(-${(idx * 100) / n}%)`, transition: 'transform 1.1s cubic-bezier(.77,0,.18,1)' }}>
          {slides.map((s, i) => {
            const on = i === idx;
            return (
              <div key={s.title} style={{ width: `${100 / n}%`, flex: 'none', position: 'relative', overflow: 'hidden' }}>
                <div style={{ ...photo(s.img), position: 'absolute', inset: 0, animation: on ? 'ftZoom 10s ease-out forwards' : 'none' }} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, ${C.deep} 12%, rgba(43,42,122,0.8) 50%, rgba(18,181,166,0.3) 100%)` }} />
                <div style={{ ...wrap, position: 'relative', padding: '100px 24px 160px', minHeight: 420 }}>
                  <span style={{ display: 'inline-block', background: C.sun, color: C.ink, fontWeight: 800, fontSize: 14, padding: '6px 16px', borderRadius: 999, ...(on ? { animation: 'ftUp .7s .05s both' } : { opacity: 0 }) }}>{s.tag}</span>
                  <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(36px, 6.2vw, 68px)', lineHeight: 1.08, color: C.white, margin: '22px 0 20px', maxWidth: 780 }}>
                    <Words text={s.title} on={on} />
                  </h1>
                  <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 20, maxWidth: 540, margin: '0 0 34px', ...(on ? { animation: 'ftUp .8s .9s both' } : { opacity: 0 }) }}>{s.sub}</p>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...(on ? { animation: 'ftUp .8s 1.1s both' } : { opacity: 0 }) }}>
                    <Link to="/signup" style={btn(C.coral, C.white)}>Start talking free</Link>
                    <a href="#how" style={btn('transparent', C.white, { borderColor: C.white })}>See how it works</a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ft-bub" style={bubble(C.white, C.indigo, { right: '7%', top: 70 })}>¿Cómo estás?</div>
        <div className="ft-bub" style={bubble(C.teal, C.white, { right: '15%', top: 150, borderRadius: '22px 22px 4px 22px', animationDelay: '1s' })}>Très bien, merci!</div>
        <div className="ft-bub" style={bubble(C.sun, C.ink, { right: '4%', top: 230, animationDelay: '2s' })}>Karibu sana!</div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 82 }}>
          <div style={{ ...wrap, display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="ft-arrow" aria-label="Previous slide" onClick={() => go(-1)} style={arrow}>‹</button>
            <button className="ft-arrow" aria-label="Next slide" onClick={() => go(1)} style={arrow}>›</button>
            <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
              {slides.map((s, i) => (
                <button key={s.tag} aria-label={`Go to slide ${i + 1}`} onClick={() => setIdx(i)} style={{ width: i === idx ? 56 : 14, height: 8, borderRadius: 8, border: 0, padding: 0, cursor: 'pointer', background: 'rgba(255,255,255,0.4)', overflow: 'hidden', transition: 'width .4s' }}>
                  {i === idx && <span key={idx} style={{ display: 'block', height: '100%', background: C.sun, animation: 'ftFill 6.5s linear both', animationPlayState: paused ? 'paused' : 'running' }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ ...wrap, marginTop: -56, position: 'relative', zIndex: 2 }}>
        <Reveal>
          <div style={{ ...grid(180, 0), borderRadius: 24, overflow: 'hidden', boxShadow: '0 18px 40px rgba(43,42,122,0.25)' }}>
            {stats.map(([to, suf, dec, l], i) => (
              <div key={l} style={{ padding: '26px 24px', textAlign: 'center', background: i % 2 ? '#ffd45f' : C.sun }}>
                <div style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 700, color: C.deep }}><Count to={to} suffix={suf} dec={dec} /></div>
                <div style={{ fontWeight: 700 }}>{l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* About */}
      <section style={{ padding: '110px 0 90px', position: 'relative', overflow: 'hidden' }}>
        <div style={blob(C.teal, 340, { top: 40, left: -120 })} />
        <div style={{ ...wrap, ...grid(320, 40), alignItems: 'center', position: 'relative' }}>
          <Reveal from="left">
            <div style={{ overflow: 'hidden', borderRadius: 28 }}>
              <div className="ft-img" style={photo(IMG.friends, { height: 460, ...fade('to right') })} />
            </div>
          </Reveal>
          <Reveal from="right" delay={0.15}>
            <h2 style={h2}>Apps teach you words. People teach you to talk.</h2>
            <p style={{ ...lead, marginBottom: 20 }}>Flashcards only go so far. Fluency comes from real conversations with someone patient, curious and happy to help.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 12, fontWeight: 700 }}>
              {[['Native and fluent speakers, matched to you', C.coral], ['Corrections right inside the chat', C.teal], ['Text, voice and video, whenever you like', C.sun]].map(([t, c]) => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, flex: 'none' }} />{t}
                </li>
              ))}
            </ul>
            <Link to="/signup" style={btn(C.indigo, C.white)}>Find a partner</Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ background: `linear-gradient(180deg, ${C.white} 0%, ${C.sky} 22%, ${C.sky} 100%)`, padding: '96px 0 88px' }}>
        <div style={wrap}>
          <Reveal>
            <h2 style={{ ...h2, textAlign: 'center' }}>Your first conversation in four steps</h2>
            <p style={{ ...lead, margin: '0 auto 56px', textAlign: 'center' }}>Most members are chatting within five minutes of signing up.</p>
          </Reveal>
          <div style={grid(220, 32)}>
            {steps.map(([t, d, c], i) => (
              <Reveal key={t} delay={i * 0.14}>
                <div className="ft-lift" style={{ textAlign: 'center' }}>
                  <div style={{ width: 76, height: 76, borderRadius: '50%', background: c, color: c === C.sun ? C.ink : C.white, display: 'grid', placeItems: 'center', fontFamily: SERIF, fontSize: 32, fontWeight: 700, margin: '0 auto 18px', boxShadow: `0 0 0 8px ${c}33` }}>{i + 1}</div>
                  <h3 style={{ fontSize: 19, margin: '0 0 6px' }}>{t}</h3>
                  <p style={{ margin: 0, color: C.muted }}>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Languages: click a bubble */}
      <section id="languages" style={{ background: C.deep, padding: '92px 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={blob(C.coral, 380, { top: -100, right: -80 })} />
        <div style={blob(C.teal, 320, { bottom: -120, left: -80 })} />
        <div style={{ ...wrap, position: 'relative' }}>
          <Reveal>
            <h2 style={{ ...h2, color: C.white }}>Say hello in 40+ languages</h2>
            <p style={{ ...lead, color: 'rgba(255,255,255,0.8)', margin: '0 auto 44px' }}>Tap a greeting to see who is online right now.</p>
          </Reveal>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            {hellos.map(([w, c, l, online, dark], i) => (
              <Reveal key={l} delay={i * 0.06}>
                <div className="ft-pop" role="button" tabIndex={0} onClick={() => setLang({ l, online })} onKeyDown={(e) => e.key === 'Enter' && setLang({ l, online })}
                  style={{ background: c, color: dark ? C.ink : C.white, padding: '14px 26px', borderRadius: i % 2 ? '28px 28px 28px 6px' : '28px 28px 6px 28px', minWidth: 130, outline: lang?.l === l ? `3px solid ${C.white}` : 'none', outlineOffset: 3 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700 }}>{w}</div>
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

      {/* Learner / speaker split */}
      <section id="speakers" style={grid(340, 0)}>
        {[[C.coral, 'If you are learning', 'Practice without pressure. Ask questions, make mistakes and get friendly corrections in the moment.', 'Join as a learner', C.white, C.coral, 'left'],
          [C.teal, 'If you speak it well', 'Share your language, meet people worldwide and earn rewards for every helpful session.', 'Join as a speaker', C.deep, C.white, 'right']].map(([bg, t, d, b, bb, bc, from]) => (
          <div key={t} style={{ background: bg, color: C.white, padding: '84px 48px', overflow: 'hidden' }}>
            <Reveal from={from}>
              <h2 style={{ ...h2, color: C.white }}>{t}</h2>
              <p style={{ fontSize: 18, margin: '0 0 24px', maxWidth: 440 }}>{d}</p>
              <Link to="/signup" style={btn(bb, bc)}>{b}</Link>
            </Reveal>
          </div>
        ))}
      </section>

      {/* Features */}
      <section style={{ padding: '100px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ ...wrap, ...grid(320, 40), alignItems: 'center' }}>
          <Reveal from="left">
            <h2 style={h2}>Everything you need to keep going</h2>
            <div style={{ display: 'grid', gap: 22, marginTop: 28 }}>
              {[['Inline corrections', 'See the right form straight away, right where you made the mistake.', C.coral],
                ['Phrasebook', 'Save new words and phrases and review them whenever you like.', C.teal],
                ['Daily streaks', 'Short, friendly reminders that turn practice into a habit.', C.sun]].map(([t, d, c]) => (
                <div key={t} className="ft-lift" style={{ borderLeft: `6px solid ${c}`, paddingLeft: 18 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{t}</div>
                  <div style={{ color: C.muted }}>{d}</div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal from="right" delay={0.15}>
            <div style={{ overflow: 'hidden', borderRadius: 28 }}>
              <div className="ft-img" style={photo(IMG.online, { height: 440, ...fade('to left') })} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Testimonial */}
      <section id="stories" style={{ background: `linear-gradient(180deg, ${C.white} 0%, ${C.blush} 20%, ${C.blush} 80%, ${C.white} 100%)`, padding: '100px 0' }}>
        <div style={{ ...wrap, ...grid(300, 48), alignItems: 'center' }}>
          <Reveal from="left">
            <div style={{ overflow: 'hidden', borderRadius: 28 }}>
              <div className="ft-img" style={photo(IMG.team, { height: 380, ...fade('to right') })} />
            </div>
          </Reveal>
          <Reveal from="right" delay={0.15}>
            <div style={{ fontFamily: SERIF, fontSize: 90, lineHeight: 0.6, color: C.coral }}>“</div>
            <p style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.4, margin: '0 0 22px' }}>
              I studied French for years and froze when I spoke. Three weeks of chats with Camille and I finally ordered dinner in Paris without panic.
            </p>
            <div style={{ fontWeight: 800 }}>Amina Odhiambo</div>
            <div style={{ color: C.muted }}>Learning French, member since 2025</div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '70px 0 90px' }}>
        <div style={{ ...wrap, maxWidth: 820 }}>
          <Reveal><h2 style={{ ...h2, textAlign: 'center', marginBottom: 32 }}>Questions, answered</h2></Reveal>
          {faqs.map(([q, a], i) => (
            <Reveal key={q} delay={i * 0.1}>
              <details style={{ borderBottom: `2px solid ${[C.coral, C.teal, C.sun, C.indigo][i]}`, padding: '18px 4px' }}>
                <summary style={{ fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>{q}</summary>
                <p style={{ margin: '10px 0 0', color: C.muted }}>{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ ...photo(IMG.talk), position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(120deg, ${C.coral}ee, ${C.indigo}ee)` }} />
        <div style={{ ...wrap, position: 'relative', padding: '96px 24px' }}>
          <Reveal>
            <h2 style={{ ...h2, color: C.white, fontSize: 'clamp(30px, 5vw, 50px)' }}>Ready for your first conversation?</h2>
            <p style={{ ...lead, color: C.white, margin: '0 auto 30px' }}>Create a free account and message someone today.</p>
            <Link to="/signup" style={btn(C.sun, C.ink)}>Sign up free</Link>
          </Reveal>
        </div>
      </section>

      <footer style={{ background: C.deep, color: 'rgba(255,255,255,0.8)', padding: '64px 0 28px' }}>
        <div style={{ ...wrap, ...grid(200, 40) }}>
          <div>
            <Logo light />
            <p style={{ marginTop: 16, maxWidth: 280 }}>Practice any language by talking with the people who speak it.</p>
          </div>
          {[['Product', ['How it works', 'Languages', 'Pricing', 'Voice rooms']], ['Community', ['Become a speaker', 'Guidelines', 'Safety', 'Blog']], ['Company', ['About us', 'Careers', 'help@fluencytalks.com', 'Privacy and terms']]].map(([h, items], i) => (
            <div key={h}>
              <div style={{ color: [C.sun, C.coral, C.teal][i], fontWeight: 800, marginBottom: 14 }}>{h}</div>
              <div style={{ display: 'grid', gap: 8 }}>{items.map((t) => <span key={t}>{t}</span>)}</div>
            </div>
          ))}
        </div>
        <div style={{ ...wrap, marginTop: 44, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 14 }}>© 2026 {NAME}. All rights reserved.</div>
      </footer>
    </div>
  );
}