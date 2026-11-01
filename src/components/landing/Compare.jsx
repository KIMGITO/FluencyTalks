import { BRAND } from '@/lib/site';

/** Why choose it: compared with kinds of alternatives, not named competitors. Every claim is something the app really does. */
const ROWS = [
  ['Real conversations with people', 'Yes, one to one', 'No', 'Yes'],
  ['Corrections', 'Inside the chat, saved to your phrasebook', 'Right or wrong answers only', 'Yes, in the lesson'],
  ['Native speakers', 'Matched by your language pair', 'No', 'Usually'],
  ['Cost', 'Free, no paid plans', 'Free with paid upgrades', 'Paid per hour'],
];

export default function Compare() {
  return (
    <section id="why" className="lp-compare" aria-labelledby="compare-title">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-kicker">Why {BRAND}</p>
          <h2 id="compare-title">Real conversation, free, with corrections you keep</h2>
          <p>Apps are good for words and tutors are good for structure. {BRAND} is for the part in between: using the language with someone who speaks it.</p>
        </div>
        <div className="lp-compare__scroll" data-reveal role="region" aria-labelledby="compare-title" tabIndex={0}>
          <table>
            <thead>
              <tr><th scope="col"><span className="lp-sr">Feature</span></th><th scope="col">{BRAND}</th><th scope="col">Flashcard apps</th><th scope="col">Paid tutors</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([label, ours, apps, tutors]) => (
                <tr key={label}><th scope="row">{label}</th><td>{ours}</td><td>{apps}</td><td>{tutors}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
