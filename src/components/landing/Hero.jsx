import { Link } from 'react-router-dom';
import { unsplash } from '../../theme/theme';
import { useJoinLink } from './useJoinLink';

/** Photos are decorative: the words carry the meaning, so they have empty alt text. */
const srcset = (id, widths) => widths.map((w) => `${unsplash(id, w)} ${w}w`).join(', ');
const BIG = 'photo-1543269865-cbf427effbad';
const SMALL = 'photo-1517048676732-d65bc937f952';

export default function Hero() {
  const join = useJoinLink();
  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-wrap lp-hero__grid">
        <div className="lp-hero__head">
          <p className="lp-kicker">Language exchange, person to person</p>
          <h1 id="hero-title" className="lp-hero__title">
            <span className="lp-strip">Speak a language with the people who <span className="lp-scribble"><em>speak it.</em></span></span>
          </h1>
        </div>

        <div className="lp-hero__art" aria-hidden="true">
          <figure className="lp-photo lp-photo--a"><img src={unsplash(BIG, 900)} srcSet={srcset(BIG, [500, 900, 1300])} sizes="(max-width: 56rem) 66vw, 34vw" width="900" height="1125" alt="" fetchpriority="high" decoding="async" /></figure>
          <figure className="lp-photo lp-photo--b"><img src={unsplash(SMALL, 500)} srcSet={srcset(SMALL, [300, 500])} sizes="(max-width: 56rem) 46vw, 18vw" width="500" height="500" alt="" loading="lazy" decoding="async" /></figure>
          <div className="lp-sticker"><span><b>40</b>languages, free</span></div>
        </div>

        <div className="lp-hero__body">
          <p className="lp-hero__lead">Tell us the language you speak and the one you are learning. We find people who want the opposite, you chat, and they correct you right inside the conversation.</p>
          <div className="lp-hero__cta" id="hero-cta">
            <Link to={join.to} className="lp-btn lp-btn--accent">{join.signedIn ? 'Go to your account' : 'Start talking, it is free'}</Link>
            <a href="#services" className="lp-link">See what you get <span aria-hidden="true">→</span></a>
          </div>
          <ul className="lp-hero__meta"><li>Text chat with live corrections</li><li>No payment, no ads</li></ul>
        </div>
      </div>
    </section>
  );
}
