import { C, SERIF, FONT, wrap, h2, lead } from './theme';
import { Reveal } from './Reveal';

const steps = [
  ['Pick your language', 'Choose what you are learning and your level, from first words to fluent debate.'],
  ['Meet a speaker', 'We match you with native and fluent speakers who share your interests.'],
  ['Talk and get corrected', 'Chat by text, voice or video. Mistakes are fixed as you go.'],
  ['Save and repeat', 'Keep useful phrases, track your streak and come back tomorrow.'],
];

/* Layout switches (row timeline -> vertical timeline) need media queries, so they live here. */
const CSS = `
.ft-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(20px,3vw,40px)}
.ft-step{position:relative}
.ft-step-top{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.ft-num{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:#2b2a7a;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;transition:background .25s,transform .25s}
.ft-step:hover .ft-num{background:#ff6a4d;transform:translateY(-2px)}
.ft-step-line{flex:1;height:2px;margin-right:calc(-1 * clamp(20px,3vw,40px));background:linear-gradient(90deg,rgba(43,42,122,.35),rgba(43,42,122,.1))}
@media(max-width:900px){
  .ft-steps{grid-template-columns:1fr;gap:0;max-width:540px;margin:0 auto}
  .ft-step{display:grid;grid-template-columns:46px 1fr;column-gap:18px;padding-bottom:30px}
  .ft-step-top{display:block;margin:0}
  .ft-step-line{position:absolute;left:22px;top:54px;bottom:8px;width:2px;height:auto;margin:0;background:linear-gradient(180deg,rgba(43,42,122,.35),rgba(43,42,122,.1))}
}`;

export default function HowItWorks() {
  return (
    <section id="how" style={{ background: C.sky, padding: 'clamp(56px, 9vw, 96px) 0' }}>
      <style>{CSS}</style>
      <div style={wrap}>
        <Reveal>
          <h2 style={{ ...h2, textAlign: 'center' }}>Your first conversation in four steps</h2>
          <p style={{ ...lead, margin: '0 auto clamp(32px, 5vw, 56px)', textAlign: 'center' }}>Most members are chatting within five minutes of signing up.</p>
        </Reveal>

        <ol className="ft-steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {steps.map(([title, body], i) => (
            <li key={title}>
              <Reveal delay={i * 0.12}>
                <div className="ft-step">
                  <div className="ft-step-top">
                    <span className="ft-num" aria-hidden="true">{i + 1}</span>
                    {i < steps.length - 1 && <span className="ft-step-line" aria-hidden="true" />}
                  </div>
                  <div>
                    <h3 style={{ fontFamily: FONT, fontSize: 'clamp(17px, 1.9vw, 19px)', fontWeight: 800, lineHeight: 1.3, color: C.ink, margin: '0 0 8px' }}>{title}</h3>
                    <p style={{ fontSize: 'clamp(15px, 1.7vw, 16px)', lineHeight: 1.65, color: C.muted, margin: 0, maxWidth: '34ch' }}>{body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}