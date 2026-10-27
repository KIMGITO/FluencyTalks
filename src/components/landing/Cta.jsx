import { Link } from 'react-router-dom';
import { useJoinLink } from './useJoinLink';

export default function Cta() {
  const join = useJoinLink();
  return (
    <section className="lp-cta" aria-labelledby="cta-title">
      <div className="lp-wrap">
        <div className="lp-cta__block" data-reveal>
          <h2 id="cta-title">Ready for your first <em>conversation?</em></h2>
          <p>{join.signedIn ? 'Pick up where you left off.' : 'Create a free account, choose your languages, and message someone today.'}</p>
          <Link to={join.to} className="lp-btn lp-btn--light">{join.signedIn ? 'Go to your account' : 'Create your account'}</Link>
        </div>
      </div>
    </section>
  );
}
