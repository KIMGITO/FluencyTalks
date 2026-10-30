import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
// The public-page shell (header, footer, landing look) is plain JS.
import { PublicShell } from '@/components/landing';
import { EMAILS, mailto } from '@/lib/emails';
import '@/styles/landing.css';

export interface LegalSection { id: string; short: string; tagline: string; heading: string; body: ReactNode }

const TABS: [string, string][] = [['Privacy', '/privacy'], ['Terms', '/terms'], ['Delete my data', '/data-deletion']];

export const P = ({ children }: { children: ReactNode }) => <p className="lp-p">{children}</p>;
export const Bullets = ({ items }: { items: [string, string][] }) => (
  <ul className="lp-list">
    {items.map(([title, text]) => <li key={title}><span><strong>{title}</strong> {text}</span></li>)}
  </ul>
);

/** The section being read, so the contents list can highlight it. */
function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState(ids[0]);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const inView = new Set<string>();
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? inView.add(e.target.id) : inView.delete(e.target.id)));
      const now = ids.find((id) => inView.has(id));
      if (now) setCurrent(now);
    }, { rootMargin: '-25% 0px -65% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [ids]);
  return current;
}

/**
 * Privacy, terms and data deletion: one long page you can read, search and link into, not slides.
 * Wide screens get a sticky contents list; phones get a strip of section chips under the header.
 */
export default function LegalLayout({ title, active, updated, contact = EMAILS.support, sections }: {
  title: string; active: string; updated: string; contact?: string; sections: LegalSection[];
}) {
  const ids = sections.map((s) => s.id);
  const current = useCurrentSection(ids);
  return (
    <PublicShell>
      <div className="lp-wrap">
        <header className="lp-doc__head">
          <p className="lp-kicker">Legal</p>
          <h1>{title}</h1>
          <p className="lp-doc__meta">Last updated {updated}</p>
          <nav className="lp-tabs" aria-label="Legal pages">
            {TABS.map(([label, to]) => <Link key={to} to={to} aria-current={to === active ? 'page' : undefined}>{label}</Link>)}
          </nav>
        </header>

        <div className="lp-doc">
          <nav className="lp-toc" aria-label="On this page">
            <p className="lp-toc__title">On this page</p>
            <ol>
              {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} aria-current={current === s.id ? 'true' : undefined}>{s.short}</a></li>)}
            </ol>
          </nav>
          <article className="lp-prose">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                <p className="lp-kicker">{s.tagline}</p>
                <h2 id={`${s.id}-h`}>{s.heading}</h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>

        <aside className="lp-doc__contact">
          <p>Questions about this page?</p>
          <a className="lp-btn lp-btn--accent" href={mailto(contact, { subject: `${title} question` })}>Write to {contact}</a>
        </aside>
      </div>
    </PublicShell>
  );
}
