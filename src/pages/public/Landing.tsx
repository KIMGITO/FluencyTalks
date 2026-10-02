import { Link } from 'react-router-dom';

/* ---------- Brand tokens (change here, everything updates) ---------- */
const NAME = 'Lumina Academy';
const C = {
  indigo: '#2b2a7a',
  indigoDeep: '#1b1a55',
  coral: '#ff6a4d',
  teal: '#12b5a6',
  sun: '#ffc83d',
  sky: '#e6f4ff',
  blush: '#fff0ea',
  mint: '#e3f8f4',
  ink: '#17163a',
  muted: '#5b5a7e',
  white: '#ffffff',
};
const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const img = (id, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=75`;
const IMG = {
  hero: img('photo-1523240795612-9a054b0db644', 1600),
  about: img('photo-1522202176988-66273c2fd55f'),
  lecture: img('photo-1524178232363-1fb2b075b655'),
  library: img('photo-1481627834876-b7833e8f5570'),
  class: img('photo-1427504494785-3a9ca7044f45'),
  kids: img('photo-1503676260728-1c00da094a0b'),
};

/* ---------- Shared style helpers ---------- */
const wrap = { maxWidth: 1160, margin: '0 auto', padding: '0 24px' };
const section = (bg, pad = '88px 0') => ({ background: bg, padding: pad });
const h2 = { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.15, margin: '0 0 14px', color: C.ink };
const lead = { fontSize: 18, lineHeight: 1.65, color: C.muted, maxWidth: 560, margin: 0 };
const btn = (bg, color, extra = {}) => ({
  display: 'inline-block', background: bg, color, padding: '14px 30px', borderRadius: 999,
  fontWeight: 800, fontSize: 16, textDecoration: 'none', border: '2px solid transparent', ...extra,
});
const photo = (src, extra = {}) => ({
  backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', ...extra,
});
const grid = (min, gap = 28) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap });

const nav = [
  ['About', '#about'], ['Programs', '#programs'], ['How to enroll', '#enroll'], ['Stories', '#stories'], ['Contact', '#contact'],
];

const programs = [
  { t: 'Language & Literature', d: 'Speak, read and write with confidence in more than 12 languages.', bg: C.coral, src: IMG.class },
  { t: 'Science & Technology', d: 'Hands-on labs and coding studios from beginner to advanced.', bg: C.teal, src: IMG.lecture },
  { t: 'Business & Leadership', d: 'Practical diplomas taught by people who run real companies.', bg: C.indigo, src: IMG.library },
  { t: 'Junior Academy', d: 'Playful, structured learning for ages 6 to 14.', bg: C.sun, src: IMG.kids, dark: true },
];

const steps = [
  ['Choose a program', 'Browse our programs and pick the one that fits your goals.', C.coral],
  ['Apply online', 'Fill in a ten-minute form. No entrance fee.', C.teal],
  ['Meet your advisor', 'Get a study plan and schedule built around your week.', C.sun],
  ['Start learning', 'Join your first class and meet your cohort.', C.indigo],
];

const stats = [['25,000+', 'Graduates worldwide'], ['120', 'Expert instructors'], ['94%', 'Complete their program'], ['18', 'Years of teaching']];

const faqs = [
  ['Do I need prior experience?', 'No. Every program has a beginner track with placement support.'],
  ['Can I study part-time?', 'Yes. Evening, weekend and online options are available for most programs.'],
  ['Is financial aid available?', 'Scholarships and monthly payment plans are open to all applicants.'],
];

function Logo({ light }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <span style={{ width: 38, height: 38, borderRadius: '50% 50% 50% 8px', background: `linear-gradient(135deg, ${C.coral}, ${C.sun})`, display: 'grid', placeItems: 'center', fontWeight: 900, color: C.white, fontSize: 20 }}>L</span>
      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: light ? C.white : C.indigo }}>{NAME}</span>
    </Link>
  );
}

export default function Landing() {
  return (
    <div style={{ fontFamily: FONT, color: C.ink, background: C.white, lineHeight: 1.5 }}>
      {/* Announcement bar */}
      <div style={{ background: C.coral, color: C.white, textAlign: 'center', padding: '10px 16px', fontSize: 14, fontWeight: 700 }}>
        Autumn intake is open. Applications close 30 November.
      </div>

      {/* Header */}
      <header style={{ background: C.white, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 0 rgba(43,42,122,0.08)' }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 24px' }}>
          <Logo />
          <nav style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontWeight: 700, fontSize: 15 }}>
            {nav.map(([l, h]) => <a key={l} href={h} style={{ color: C.ink, textDecoration: 'none' }}>{l}</a>)}
          </nav>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login" style={btn('transparent', C.indigo, { padding: '10px 20px', borderColor: C.indigo })}>Log in</Link>
            <Link to="/signup" style={btn(C.indigo, C.white, { padding: '10px 22px' })}>Apply now</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ ...photo(IMG.hero), position: 'relative', borderRadius: '0 0 0 120px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, ${C.indigoDeep} 15%, rgba(43,42,122,0.82) 50%, rgba(18,181,166,0.35) 100%)` }} />
        <div style={{ ...wrap, position: 'relative', padding: '110px 24px 130px' }}>
          <span style={{ display: 'inline-block', background: C.sun, color: C.ink, fontWeight: 800, fontSize: 14, padding: '6px 16px', borderRadius: 999 }}>
            Enrolling now for 2027
          </span>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(38px, 6.5vw, 72px)', lineHeight: 1.05, color: C.white, margin: '22px 0 20px', maxWidth: 760 }}>
            Learn from people who love to teach.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20, maxWidth: 540, margin: '0 0 36px' }}>
            Small classes, real mentors and programs built around your life. Start a diploma, a language or a new career this term.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link to="/signup" style={btn(C.coral, C.white)}>Start your application</Link>
            <a href="#programs" style={btn('transparent', C.white, { borderColor: C.white })}>Explore programs</a>
          </div>
        </div>
      </section>

      {/* Stats band, overlapping the hero */}
      <section style={{ ...wrap, marginTop: -56, position: 'relative', zIndex: 2 }}>
        <div style={{ ...grid(180, 0), background: C.sun, borderRadius: 24, overflow: 'hidden' }}>
          {stats.map(([n, l], i) => (
            <div key={l} style={{ padding: '26px 24px', textAlign: 'center', background: i % 2 ? '#ffd45f' : C.sun }}>
              <div style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 700, color: C.indigoDeep }}>{n}</div>
              <div style={{ fontWeight: 700, color: C.ink }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" style={section(C.white, '100px 0 88px')}>
        <div style={{ ...wrap, ...grid(320, 56), alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: -18, left: -18, width: '70%', height: '70%', background: C.teal, borderRadius: 28 }} />
            <div style={photo(IMG.about, { position: 'relative', height: 440, borderRadius: 28, borderBottomRightRadius: 120 })} />
          </div>
          <div>
            <h2 style={h2}>A school that treats you like a person, not a seat number.</h2>
            <p style={{ ...lead, marginBottom: 20 }}>
              For 18 years we have kept classes small and teachers close. You get feedback every week, a mentor who knows your goals, and a community that cheers you on.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 12, fontWeight: 700 }}>
              {[['Accredited diplomas and certificates', C.coral], ['Classes of 15 students or fewer', C.teal], ['Campus, online and hybrid study', C.sun]].map(([t, c]) => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, flex: 'none' }} />{t}
                </li>
              ))}
            </ul>
            <a href="#contact" style={btn(C.indigo, C.white)}>Book a campus visit</a>
          </div>
        </div>
      </section>

      {/* Programs: full-colour photo tiles */}
      <section id="programs" style={section(C.sky)}>
        <div style={wrap}>
          <h2 style={h2}>Programs for every stage</h2>
          <p style={{ ...lead, marginBottom: 44 }}>Pick a subject, pick a pace. Each program ends with a recognised qualification.</p>
          <div style={grid(250, 0)}>
            {programs.map((p) => (
              <div key={p.t} style={{ background: p.bg, color: p.dark ? C.ink : C.white }}>
                <div style={photo(p.src, { height: 190, opacity: 0.95 })} />
                <div style={{ padding: '24px 26px 32px', minHeight: 170 }}>
                  <h3 style={{ fontFamily: SERIF, fontSize: 24, margin: '0 0 8px' }}>{p.t}</h3>
                  <p style={{ margin: 0, fontSize: 16, opacity: 0.95 }}>{p.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to enroll: timeline */}
      <section id="enroll" style={section(C.white)}>
        <div style={wrap}>
          <h2 style={{ ...h2, textAlign: 'center' }}>Enrolling takes four steps</h2>
          <p style={{ ...lead, margin: '0 auto 56px', textAlign: 'center' }}>Most students are in class within two weeks of applying.</p>
          <div style={grid(220, 32)}>
            {steps.map(([t, d, c], i) => (
              <div key={t} style={{ textAlign: 'center' }}>
                <div style={{ width: 76, height: 76, borderRadius: '50%', background: c, color: c === C.sun ? C.ink : C.white, display: 'grid', placeItems: 'center', fontFamily: SERIF, fontSize: 32, fontWeight: 700, margin: '0 auto 18px', boxShadow: `0 0 0 8px ${c}33` }}>{i + 1}</div>
                <h3 style={{ fontSize: 19, margin: '0 0 6px' }}>{t}</h3>
                <p style={{ margin: 0, color: C.muted }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us: split image + colour blocks */}
      <section style={{ ...grid(340, 0), background: C.indigoDeep }}>
        <div style={photo(IMG.lecture, { minHeight: 420 })} />
        <div style={{ padding: '72px 48px', color: C.white }}>
          <h2 style={{ ...h2, color: C.white }}>Learn your way</h2>
          <div style={{ display: 'grid', gap: 22, marginTop: 28 }}>
            {[['Live classes', 'Join on campus or from home, with recordings for every session.', C.sun],
              ['Personal mentors', 'One advisor follows your progress from day one.', C.coral],
              ['Career support', 'CV reviews, interview practice and employer introductions.', C.teal]].map(([t, d, c]) => (
              <div key={t} style={{ borderLeft: `6px solid ${c}`, paddingLeft: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: c }}>{t}</div>
                <div style={{ opacity: 0.88 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section id="stories" style={section(C.blush)}>
        <div style={{ ...wrap, ...grid(300, 48), alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 90, lineHeight: 0.6, color: C.coral }}>“</div>
            <p style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.4, margin: '0 0 22px' }}>
              I arrived unable to order a coffee in Spanish. A year later I was leading client meetings. The teachers never let me give up.
            </p>
            <div style={{ fontWeight: 800 }}>Amina Odhiambo</div>
            <div style={{ color: C.muted }}>Diploma in Language & Literature, class of 2025</div>
          </div>
          <div style={photo(IMG.class, { height: 360, borderRadius: '140px 28px 28px 28px', boxShadow: `18px 18px 0 ${C.sun}` })} />
        </div>
      </section>

      {/* FAQ */}
      <section style={section(C.white, '80px 0')}>
        <div style={{ ...wrap, maxWidth: 820 }}>
          <h2 style={{ ...h2, textAlign: 'center', marginBottom: 32 }}>Questions, answered</h2>
          {faqs.map(([q, a], i) => (
            <details key={q} style={{ borderBottom: `2px solid ${[C.coral, C.teal, C.sun][i]}`, padding: '18px 4px' }}>
              <summary style={{ fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>{q}</summary>
              <p style={{ margin: '10px 0 0', color: C.muted }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section id="contact" style={{ background: `linear-gradient(120deg, ${C.coral}, ${C.sun})`, padding: '80px 0', textAlign: 'center' }}>
        <div style={wrap}>
          <h2 style={{ ...h2, color: C.indigoDeep, fontSize: 'clamp(30px, 5vw, 50px)' }}>Your next chapter starts here.</h2>
          <p style={{ ...lead, color: C.ink, margin: '0 auto 30px' }}>Apply in ten minutes, or talk to an advisor first.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={btn(C.indigoDeep, C.white)}>Apply now</Link>
            <a href="mailto:admissions@lumina.edu" style={btn(C.white, C.indigoDeep)}>Talk to an advisor</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: C.indigoDeep, color: 'rgba(255,255,255,0.8)', padding: '64px 0 28px' }}>
        <div style={{ ...wrap, ...grid(200, 40) }}>
          <div>
            <Logo light />
            <p style={{ marginTop: 16, maxWidth: 280 }}>Small classes, big goals. Teaching since 2008.</p>
          </div>
          {[['Programs', ['Languages', 'Science & Tech', 'Business', 'Junior Academy']],
            ['School', ['About us', 'Admissions', 'Scholarships', 'Careers']],
            ['Contact', ['12 Campus Road, Nairobi', 'admissions@lumina.edu', '+254 700 000 000', 'Mon to Fri, 8am to 5pm']]].map(([h, items], i) => (
            <div key={h}>
              <div style={{ color: [C.sun, C.coral, C.teal][i], fontWeight: 800, marginBottom: 14 }}>{h}</div>
              <div style={{ display: 'grid', gap: 8 }}>{items.map((t) => <span key={t}>{t}</span>)}</div>
            </div>
          ))}
        </div>
        <div style={{ ...wrap, marginTop: 44, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 14 }}>
          <span>© 2026 {NAME}. All rights reserved.</span>
          <span>Privacy · Terms · Accessibility</span>
        </div>
      </footer>
    </div>
  );
}