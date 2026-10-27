import { Link } from 'react-router-dom';
import { IMG, unsplash } from '../../theme/theme';
import { useJoinLink } from './useJoinLink';

/** Photos are decorative: the words carry the meaning, so they have empty alt text. */
const photo = (id, widths) => widths.map((w) => `${unsplash(id, w)} ${w}w`).join(', ');
const HERO_ID = 'photo-1543269865-cbf427effbad';
const SMALL_ID = 'photo-1517048676732-d65bc937f952';

export default function Hero() {
  const join = useJoinLink();
  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-wrap lp-hero__grid">
        <div className="lp-hero__copy">
          {/* <p className="lp-kicker">Language exchange, person to person</p> */}
          <h1 id="hero-title" className="lp-hero__title">
            <span className="lp-strip">Speak a language with the people who <em>speak it.</em></span>
          </h1>
          <p className="lp-hero__lead">
            Tell us the language you speak and the one you are learning. We find people who want the opposite, you chat, and they correct you right inside the conversation.
          </p>
          <div className="lp-hero__cta">
            <Link to={join.to} className="lp-btn lp-btn--solid">{join.signedIn ? 'Go to your account' : 'Start talking, it is free'}</Link>
            <a href="#services" className="lp-link">See what you get <span aria-hidden="true">→</span></a>
          </div>
          <ul className="lp-hero__meta">
            <li>40 languages</li>
            <li>Text chat with live corrections</li>
            <li>No payment, no ads</li>
          </ul>
        </div>

        <figure className="lp-hero__photo">
          <img src={unsplash(HERO_ID, 1000)} srcSet={photo(HERO_ID, [600, 1000, 1400])} sizes="(max-width: 56rem) 70vw, 36vw" width="1000" height="1250" alt="" fetchpriority="high" decoding="async" />
        </figure>
        <figure className="lp-hero__photo lp-hero__photo--small" aria-hidden="true">
          <img src={unsplash(SMALL_ID, 600)} srcSet={photo(SMALL_ID, [400, 600])} sizes="22vw" width="600" height="600" alt="" loading="lazy" decoding="async" />
        </figure>
      </div>
    </section>
  );
}
