import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EMAILS } from '@/lib/emails';
import { legalCSS } from '@/theme/componentStyles';
import { Logo } from '../ui';

import '@/styles/landing.css';

export interface LegalSection { id: string; short: string; tagline: string; heading: string; body: ReactNode }

const LINKS = [
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Delete my data', '/data-deletion'],
];


export const P = ({ children }: { children: ReactNode }) => <p className="lg-text">{children}</p>;
export const Bullets = ({ items }: { items: [string, string][] }) => (
  <ul className="lg-list">
    {items.map(([t, d]) => (
      <li key={t} className="lg-list-item">
        <span className="lg-bullet" aria-hidden="true" />
        <span>
          <strong>{t}</strong> {d}
        </span>
      </li>
    ))}
  </ul>
);


export default function LegalLayout({
  title,
  active,
  updated,
  contact = EMAILS.support,
  sections,
}: {
  title: string;
  active: string;
  updated: string;
  contact?: string;
  sections: LegalSection[];
}) {
  const n = sections.length;
  const [i, setI] = useState(() =>
    Math.max(
      0,
      sections.findIndex((s: LegalSection) => `#${s.id}` === window.location.hash),
    ),
  );
  const cur = sections[i];

  const go = useCallback(
    (k: number) => {
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
    const key = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [i, go]);

  return (
    <div className="lp">
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

      <main id="lg-top" className="lg-main">
        <section className="lg-panel" aria-labelledby="lg-h">
          <div className="lg-content">
            <div className="lp-wrap">
              <h1 className="lg-sr">{title}</h1>
              <div className="lg-meta">
                <span className="lg-crumb">{title}</span>
                {updated && <span className="lg-upd">Updated {updated}</span>}
              </div>

              <article key={cur.id} className="lg-in ft-selectable">
                <div className="lp-section-head">
                  {cur.tagline && <p className="lp-kicker">{cur.tagline}</p>}
                  <h2 id="lg-h" className="lg-h">
                    {cur.heading}
                  </h2>
                </div>
                {cur.body}
              </article>

              <div className="lg-ctl">
                <div className="lg-row">
                  <span>
                    Section {i + 1} of {n}
                  </span>
                  <span className="flex gap-2">
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
          </div>
        </section>
      </main>
    </div>
  );
}
