import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJoinLink } from './useJoinLink';

/**
 * On a phone, a slim "start" bar appears once the hero button has scrolled out of view (above the screen),
 * and hides again when the footer comes into view. It reads positions on scroll instead of using an
 * IntersectionObserver: an observer only fires when visibility changes, so jumping straight past the hero
 * (for example with a menu link) would never show the bar.
 */
export default function StickyCta() {
  const join = useJoinLink();
  const [on, setOn] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const hero = document.getElementById('hero-cta');
      const footer = document.querySelector('.lp-footer');
      const pastHero = !!hero && hero.getBoundingClientRect().bottom < 0;
      const atFooter = !!footer && footer.getBoundingClientRect().top < window.innerHeight;
      setOn(pastHero && !atFooter);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);
  if (join.signedIn) return null;
  return (
    <div className={`lp-sticky${on ? ' is-on' : ''}`} aria-hidden={!on}>
      <span>Ready to talk?</span>
      <Link to={join.to} tabIndex={on ? 0 : -1} className="lp-btn lp-btn--accent lp-btn--sm">Start free</Link>
    </div>
  );
}
