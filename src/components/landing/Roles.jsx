import { Link } from 'react-router-dom';
import { useJoinLink } from './useJoinLink';

export default function Roles() {
  const join = useJoinLink();
  return (
    <section id="speakers" className="lp-roles" aria-labelledby="roles-title">
      <div className="lp-wrap">
        <h2 id="roles-title" className="lp-sr" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Two ways to take part</h2>
        <div className="lp-roles__grid">
          <article className="lp-role lp-role--learn" data-reveal>
            <p className="lp-kicker">If you are learning</p>
            <h3>Practise without pressure</h3>
            <p>Ask questions, make mistakes, and get a friendly correction at the moment it helps.</p>
            <ul>
              <li>Choose the language and the level you are at, from A1 to C2</li>
              <li>Message people who speak it natively</li>
              <li>Save what you learn in your own phrasebook</li>
            </ul>
            <Link to={join.to} className="lp-btn lp-btn--accent">{join.signedIn ? 'Go to your account' : 'Join as a learner'}</Link>
          </article>
          <article className="lp-role lp-role--speak" data-reveal style={{ '--d': '.12s' }}>
            <p className="lp-kicker">If you speak it well</p>
            <h3>Share your language</h3>
            <p>Help someone who is a few steps behind you.</p>
            <ul>
              <li>Correct sentences and earn 5 points for each one accepted</li>
              <li>Answer bounties for 50 points</li>
              <li>Add phrases to the public library</li>
            </ul>
            <Link to={join.to} className="lp-link">{join.signedIn ? 'Open the app' : 'Join as a speaker'} <span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </div>
    </section>
  );
}
