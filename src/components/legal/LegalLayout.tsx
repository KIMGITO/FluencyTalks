import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { C, FONT, photo } from '@/theme/theme';
import { Logo } from '../ui';

const LINKS = [
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Delete my data', '/delete-account'],
];
const OFFSET = 'max(0px, calc((100vw - 1240px) / 2))'; // keeps the panel aligned with the header on wide screens

const CSS = `
@keyframes lgIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes lgDrift{from{transform:scale(1.03)}to{transform:scale(1.09) translateX(-1%)}}
.lg-bar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid #e6e8f5}
.lg-bar-in{max-width:1240px;margin:0 auto;padding:10px 24px;display:flex;align-items:center;gap:20px;min-height:68px}
.lg-links{display:flex;gap:6px;margin-left:auto}
.lg-link{padding:8px 14px;border-radius:999px;font-weight:700;font-size:14px;color:#5b5a7e;text-decoration:none;transition:background .2s,color .2s}
.lg-link:hover{background:#e6f4ff;color:#2b2a7a}.lg-link.on{background:#2b2a7a;color:#fff}
.lg-back{font-weight:800;font-size:14px;color:#2b2a7a;text-decoration:none;white-space:nowrap}.lg-back:hover{color:#ff6a4d}
.lg-chip{display:none;margin-left:auto;padding:6px 12px;border-radius:999px;background:#e6f4ff;color:#2b2a7a;font-weight:800;font-size:13px;white-space:nowrap}
.lg-stage{position:relative;display:flex;min-height:calc(100vh - 68px);min-height:calc(100dvh - 68px);overflow:hidden;scroll-margin-top:68px}
.lg-left{justify-content:flex-start}.lg-right{justify-content:flex-end}
.lg-media{position:absolute;inset:0;overflow:hidden;background:#1b1a55}
.lg-panel{position:relative;display:flex;width:max(60%, calc(clamp(460px,46vw,640px) + ${OFFSET}))}
.lg-frost{position:absolute;inset:0}
.lg-content{position:relative;width:100%;display:flex;flex-direction:column;justify-content:center;padding:clamp(28px,4vw,48px) 0}
.lg-left .lg-content{padding-left:calc(24px + ${OFFSET});padding-right:clamp(40px,8vw,120px)}
.lg-right .lg-content{padding-right:calc(24px + ${OFFSET});padding-left:clamp(40px,8vw,120px)}
.lg-meta{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px;font-size:13px;font-weight:700;color:#5b5a7e}
.lg-tabs{display:flex;gap:8px;overflow-x:auto;margin:0 0 clamp(18px,3vw,28px);padding:0 0 4px;list-style:none;scrollbar-width:none}
.lg-tabs::-webkit-scrollbar{display:none}
.lg-tab{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;border:1px solid rgba(23,22,58,.16);background:rgba(255,255,255,.7);color:#17163a;font:700 13px/1 inherit;cursor:pointer;white-space:nowrap;transition:background .2s,color .2s,border-color .2s}
.lg-tab b{font-family:Georgia,serif;color:#ff6a4d}.lg-tab:hover{border-color:#2b2a7a}
.lg-tab.on{background:#2b2a7a;color:#fff;border-color:#2b2a7a}.lg-tab.on b{color:#ffc83d}
.lg-in{animation:lgIn .45s cubic-bezier(.2,.8,.2,1) both}
.lg-ctl{margin-top:clamp(22px,3vw,34px);padding-top:18px;border-top:1px solid rgba(23,22,58,.12)}
.lg-prog{height:3px;border-radius:3px;background:rgba(23,22,58,.12);margin-bottom:14px;overflow:hidden}
.lg-prog span{display:block;height:100%;background:#ff6a4d;transition:width .4s}
.lg-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:700;font-size:14px;color:#5b5a7e}
.lg-nb{height:42px;padding:0 18px;border-radius:999px;border:2px solid #2b2a7a;background:transparent;color:#2b2a7a;font-weight:800;font-size:14px;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.lg-nb:hover{background:#2b2a7a;color:#fff}.lg-nb.p{background:#2b2a7a;color:#fff}.lg-nb.p:hover{background:#ff6a4d;border-color:#ff6a4d}
.lg-fine{margin:14px 0 0;font-size:13px;color:#5b5a7e}.lg-fine a{color:#2b2a7a;font-weight:800}
.lg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
a:focus-visible,button:focus-visible{outline:3px solid #ffc83d;outline-offset:2px;border-radius:8px}
@media(max-width:900px){.lg-links{display:none}.lg-chip{display:block}}
@media(max-width:820px){
  .lg-stage{flex-direction:column;min-height:0}
  .lg-media{position:relative;inset:auto;height:clamp(190px,46vw,300px);flex:none}
  .lg-panel{width:100%;background:var(--lg-tint)}.lg-frost{display:none}
  .lg-left .lg-content,.lg-right .lg-content{padding:24px 20px 36px}
  .lg-nb{height:44px}
}
@media(max-width:520px){.lg-bar .ft-logo-text{display:none}.lg-bar-in{gap:12px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

/* Text helpers so each page stays short and consistent */
export const P = ({ children }) => (
  <p
    style={{
      margin: '0 0 14px',
      lineHeight: 1.7,
      fontSize: 'clamp(15px, 1.7vw, 16.5px)',
      color: C.ink,
    }}
  >
    {children}
  </p>
);
export const Bullets = ({ items }) => (
  <ul
    style={{
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: 10,
    }}
  >
    {items.map(([t, d]) => (
      <li
        key={t}
        style={{
          display: 'flex',
          gap: 12,
          lineHeight: 1.6,
          fontSize: 'clamp(15px, 1.7vw, 16.5px)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: C.coral,
            marginTop: 9,
            flex: 'none',
          }}
        />
        <span>
          <strong>{t}</strong> {d}
        </span>
      </li>
    ))}
  </ul>
);

/**
 * props: title, active (route of this page), updated, contact,
 * sections: [{ id, short, tagline, heading, body, img, tint (6-digit hex), side: 'left' | 'right' }]
 */
export default function LegalLayout({
  title,
  active,
  updated,
  contact = 'help@fluencytalks.com',
  sections,
}) {
  const n = sections.length;
  const [i, setI] = useState(() =>
    Math.max(
      0,
      sections.findIndex((s) => `#${s.id}` === window.location.hash),
    ),
  );
  const cur = sections[i];
  const toward = cur.side === 'left' ? 'right' : 'left';

  const go = useCallback(
    (k) => {
      setI((k + n) % n);
      if (window.innerWidth <= 820)
        document
          .getElementById('lg-top')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [n],
  );

  useEffect(() => {
    window.history.replaceState(window.history.state, '', `#${cur.id}`);
  }, [cur.id]);
  useEffect(() => {
    const key = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [i, go]);

  const mask = `linear-gradient(to ${toward}, #000 70%, transparent 100%)`;

  return (
    <div style={{ fontFamily: FONT, color: C.ink, background: C.white }}>
      <style>{CSS}</style>

      <header className="lg-bar">
        <div className="lg-bar-in flex justify-between items-center">
          <Logo />
          <nav className="lg-links flex" aria-label="Legal pages">
            {LINKS.map(([l, to]) => (
              <Link
                key={to}
                to={to}
                className={`lg-link${to === active ? ' on' : ''}`}
                aria-current={to === active ? 'page' : undefined}
              >
                {l}
              </Link>
            ))}
          </nav>
          <Link to="/" className="lg-back">
            Home
          </Link>
        </div>
      </header>

      <main
        id="lg-top"
        className={`lg-stage lg-${cur.side}`}
        style={{ '--lg-tint': cur.tint }}
      >
        <div className="lg-media" aria-hidden="true">
          {sections.map((s, k) => (
            <div
              key={s.id}
              style={{
                ...photo(s.img),
                position: 'absolute',
                inset: 0,
                opacity: k === i ? 1 : 0,
                transition: 'opacity .9s ease',
                animation: 'lgDrift 24s ease-in-out infinite alternate',
              }}
            />
          ))}
        </div>

        <section className="lg-panel" aria-labelledby="lg-h">
          <div
            aria-hidden="true"
            style={{
              background: `linear-gradient(to ${toward}, ${cur.tint}ee 0%, ${cur.tint}e0 55%, ${cur.tint}00 100%)`,
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              WebkitMaskImage: mask,
              maskImage: mask,
            }}
          />
          <div className="lg-content">
            <h1 className="lg-sr">{title}</h1>
            <div className="lg-meta">
              <span>{title}</span>
            </div>

            <article key={cur.id} className="lg-in">
              {cur.tagline && (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: C.coral,
                    marginBottom: 10,
                  }}
                >
                  {cur.tagline}
                </div>
              )}
              <h2
                id="lg-h"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 'clamp(26px, 3.6vw, 38px)',
                  lineHeight: 1.2,
                  margin: '0 0 16px',
                  color: C.ink,
                }}
              >
                {cur.heading}
              </h2>
              {cur.body}
            </article>

            <div className="lg-ctl">
              <div className="lg-row">
                <span>
                  {i + 1} of {n}
                </span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="lg-nb"
                    onClick={() => go(i - 1)}
                    aria-label="Previous section"
                  >
                    Previous
                  </button>
                  <button
                    className="lg-nb p"
                    onClick={() => go(i + 1)}
                    aria-label="Next section"
                  >
                    {i === n - 1 ? 'Start over' : 'Next'}
                  </button>
                </span>
              </div>
              <p className="lg-fine">
                Questions? <a href={`mailto:${contact}`}>{contact}</a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
