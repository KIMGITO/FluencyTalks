import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SUPPORT_SUBJECT } from '@/lib/site';

/** Replaces the invented testimonials: a short, true account of what this is. */
export default function Project() {
  return (
    <section id="project" className="lp-project" aria-labelledby="project-title">
      <div className="lp-wrap lp-project__grid">
        <div className="lp-project__text" data-reveal>
          <p className="lp-kicker">The project</p>
          <h2 id="project-title">Built by students, and it runs for real</h2>
          <p>{BRAND} started as a university computer science project. It is a working app, not a mock-up: sign-up, matching, chat, corrections, points and moderation all run for real.</p>
          <p>It is still young, so expect rough edges. If something breaks or you have an idea, <a className="lp-link" href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>write to us</a>.</p>
        </div>
        <dl className="lp-facts" data-reveal style={{ '--d': '.12s' }}>
          <div><dt>Built with</dt><dd>React, TypeScript and Supabase</dd></div>
          <div><dt>Languages at launch</dt><dd>40</dd></div>
          <div><dt>Cost to use</dt><dd>Free</dd></div>
        </dl>
      </div>
    </section>
  );
}
