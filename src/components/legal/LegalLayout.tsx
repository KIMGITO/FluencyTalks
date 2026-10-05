import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { photo } from '@/theme/theme';
import {
  legalCSS,       // <style> sheet for the whole legal shell
  legalPage,      // root page wrapper (font + colours)
  legalText,      // <P> paragraph style
  legalList,      // <Bullets> list style
  legalListItem,  // one bullet row
  legalBulletDot, // accent dot marker
} from '@/theme/componentStyles';
import { Logo } from '../ui';

const LINKS = [
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Delete my data', '/data-deletion'],
];

/* Text helpers so each page stays short and consistent.
   Their style objects live in theme/componentStyles.js so any page can reuse them. */
export const P = ({ children }) => <p style={legalText}>{children}</p>;
export const Bullets = ({ items }) => (
  <ul style={legalList}>
    {items.map(([t, d]) => (
      <li key={t} style={legalListItem}>
        <span style={legalBulletDot} />
        <span>
          <strong>{t}</strong> {d}
        </span>
      </li>
    ))}
  </ul>
);

/**
 * props: title, active (route of this page), updated, contact,
 * sections: [{ id, short, tagline, heading, body, img, tint (6-digit hex accent used for the title chip), side: 'left' | 'right' }]
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

  const mask = `linear-gradient(to ${toward}, black 0%, black 86%, transparent 100%)`;

  return (
    <div style={legalPage}>
      <style>{legalCSS}</style>

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
            className="lg-frost"
            style={{
              background: `linear-gradient(to ${toward}, rgb(var(--c-surface) / .8) 0%, rgb(var(--c-surface) / .7) 68%, rgb(var(--c-surface) / .4) 86%, rgb(var(--c-surface) / 1) 100%)`,
              WebkitMaskImage: mask,
              maskImage: mask,
            }}
          />
          <div className="lg-content">
            <h1 className="lg-sr">{title}</h1>
            <div className="lg-meta">
              <span className="lg-crumb">{title}</span>
              {updated && <span className="lg-upd">Updated {updated}</span>}
            </div>

            <article key={cur.id} className="lg-in ft-selectable">
              {cur.tagline && <div className="lg-tag">{cur.tagline}</div>}
              <h2 id="lg-h" className="lg-h">
                {cur.heading}
              </h2>
              {cur.body}
            </article>

            <div className="lg-ctl">
              <div className="lg-row">
                <span>
                  Section {i + 1} of {n}
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
                Questions about this page? Write to{' '}
                <a href={`mailto:${contact}`}>{contact}</a>.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
