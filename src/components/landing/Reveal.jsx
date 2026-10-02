import { useState, useEffect, useRef } from 'react';

export function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setSeen(true); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); o.disconnect(); } }, { threshold: 0.15 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, seen];
}

export function Reveal({ children, delay = 0, from = 'up', style = {} }) {
  const [ref, seen] = useInView();
  const t = { up: 'translateY(32px)', left: 'translateX(-40px)', right: 'translateX(40px)' }[from];
  return (
    <div ref={ref} style={{ opacity: seen ? 1 : 0, transform: seen ? 'none' : t, transition: `opacity .9s ${delay}s ease, transform .9s ${delay}s cubic-bezier(.2,.8,.2,1)`, ...style }}>
      {children}
    </div>
  );
}

export function Count({ to, suffix = '', dec = 0 }) {
  const [ref, seen] = useInView();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let s;
    const f = (t) => { s = s || t; const p = Math.min((t - s) / 1600, 1); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, [seen, to]);
  return <span ref={ref}>{v.toFixed(dec)}{suffix}</span>;
}

export const Words = ({ text, on }) => text.split(' ').map((w, i) => (
  <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: 8 }}>
    <span style={{ display: 'inline-block', marginRight: '0.28em', opacity: on ? undefined : 0, animation: on ? `ftWord .8s ${0.2 + i * 0.09}s cubic-bezier(.2,.8,.2,1) both` : 'none' }}>{w}</span>
  </span>
));
