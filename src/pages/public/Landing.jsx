import { useEffect, useRef } from 'react';
import { Header, Hero, Intro, Services, Languages, Roles, Project, Faq, Cta, Footer } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '@/lib/site';
import '@/styles/landing.css';

/**
 * A light fade-and-rise for anything marked data-reveal. Content is visible without JavaScript
 * (the hiding class is only added once this runs) and for people who prefer reduced motion (see landing.css).
 */
function useScrollReveal(root) {
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const targets = el.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) return undefined;
    el.classList.add('js-reveal');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((t) => obs.observe(t));
    return () => { obs.disconnect(); el.classList.remove('js-reveal'); };
  }, [root]);
}

export default function Landing() {
  useSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: '/' });
  const root = useRef(null);
  useScrollReveal(root);
  return (
    <div className="lp" ref={root}>
      <Header />
      <main id="main">
        <Hero />
        <Intro />
        <Services />
        <Languages />
        <Roles />
        {/* <Project /> */}
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
