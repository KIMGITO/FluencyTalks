import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui';

export type LegalSection = { heading: string; body: ReactNode };

/** Shared shell for the public legal pages (privacy, terms, data deletion). */
export const LegalPage = ({ title, summary, sections, placeholder }: {
  title: string; summary: string; sections: LegalSection[];
  /** Note shown at the bottom so placeholder text is never mistaken for final copy. */
  placeholder?: string;
}) => (
  <div className="min-h-screen bg-bg text-ink">
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/" aria-label="FluencyTalks home"><Logo /></Link>
        <Link to="/" className="text-sm text-muted hover:text-brand">Back to home</Link>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <p className="mt-6 leading-relaxed">{summary}</p>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            <div className="mt-2 space-y-3 leading-relaxed text-muted">{s.body}</div>
          </section>
        ))}
      </div>
      <p className="mt-10 rounded-md border border-dashed border-border bg-surface-2 p-4 text-sm text-muted">
        {placeholder ?? `Placeholder page — replace this text with the final ${title} before launch.`}
      </p>
      <p className="mt-6 text-sm text-muted">
        Questions? Write to <a className="text-brand underline" href="mailto:help@fluencytalks.com">help@fluencytalks.com</a>.
      </p>
    </main>
  </div>
);
