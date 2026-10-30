import { useEffect } from 'react';

/**
 * A light fade-and-rise for anything marked data-reveal inside `root`. Content stays visible without
 * JavaScript (the hiding class is only added here) and for people who prefer reduced motion (see landing.css).
 */
export function useReveal(root) {
  useEffect(() => {
    const el = root.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    el.classList.add('js-reveal');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    el.querySelectorAll('[data-reveal]').forEach((t) => obs.observe(t));
    return () => { obs.disconnect(); el.classList.remove('js-reveal'); };
  }, [root]);
}
