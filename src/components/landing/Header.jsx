import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Logo, ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

export const NAV = [
  { id: 'services', label: 'What you get' },
  { id: 'languages', label: 'Languages' },
  { id: 'speakers', label: 'For speakers' },
  { id: 'project', label: 'The project' },
  { id: 'faq', label: 'FAQ' },
];

/** The section the reader is in, so the nav can show where they are. */
function useActiveSection(ids) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || !('IntersectionObserver' in window)) return undefined;
    const inView = new Set();
    // A thin band across the upper-middle of the screen: the section crossing it is "current".
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? inView.add(e.target.id) : inView.delete(e.target.id)));
      const current = ids.filter((id) => inView.has(id)).pop() ?? null;
      setActive((prev) => current ?? (window.scrollY < 200 ? null : prev));
    }, { rootMargin: '-40% 0px -55% 0px' });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);
  return [active, setActive];
}

const IDS = NAV.map((n) => n.id);

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useActiveSection(IDS);
  const meta = user?.user_metadata ?? {};
  const name = meta.full_name || meta.name || meta.display_name || user?.email || 'You';

  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const max = d.scrollHeight - d.clientHeight;
      setProgress(max > 0 ? d.scrollTop / max : 0);
      if (d.scrollTop < 200) setActive(null);   // back at the top: no section is current (the observer may not fire again)
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [setActive]);

  // The mobile menu: Escape closes it, the page behind does not scroll, and it closes on a wider screen.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth > 900 && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [open]);

  const go = (id) => { setActive(id); setOpen(false); };
  const links = NAV.map(({ id, label }) => (
    <a key={id} href={`#${id}`} aria-current={active === id ? 'true' : undefined} onClick={() => go(id)}>{label}</a>
  ));

  return (
    <header className={`lp-header${progress > 0.005 ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="lp-skip" href="#main">Skip to main content</a>
      <div className="lp-wrap lp-header__row">
        <Logo />
        <nav className="lp-nav" aria-label="Main">{links}</nav>
        <div className="lp-header__actions">
          {user && <ThemeToggle />}
          {authLoading ? null : user ? (
            <Link to="/home" aria-label="Open your account" title={name}><Avatar name={name} src={meta.avatar_url || meta.picture || null} size="sm" /></Link>
          ) : (
            <>
              <Link to="/login" className="lp-textlink">Log in</Link>
              <Link to="/signup" className="lp-btn lp-btn--solid lp-btn--sm">Sign up free</Link>
            </>
          )}
          <button type="button" className="lp-burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="lp-drawer" onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
        </div>
      </div>
      <div id="lp-drawer" className="lp-drawer" role="navigation" aria-label="Mobile">
        <div className="lp-wrap">
          {links}
          {!authLoading && (user
            ? <Link to="/home" className="lp-btn lp-btn--solid" onClick={() => setOpen(false)}>Go to your account</Link>
            : <><Link to="/signup" className="lp-btn lp-btn--solid" onClick={() => setOpen(false)}>Sign up free</Link><Link to="/login" onClick={() => setOpen(false)} style={{ borderBottom: 0, fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 600 }}>Log in</Link></>)}
        </div>
      </div>
      <div className="lp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
    </header>
  );
}
