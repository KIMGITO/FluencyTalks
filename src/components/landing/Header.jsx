import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar, Logo, ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

export const NAV = [
  { id: 'services', label: 'What you get' },
  { id: 'languages', label: 'Languages' },
  { id: 'speakers', label: 'For speakers' },
  // { id: 'project', label: 'The project' },
  { id: 'faq', label: 'FAQ' },
];
const IDS = NAV.map((n) => n.id);

/** The section the reader is in (home page only), so the nav can show where they are. */
function useActiveSection(enabled) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (!enabled || !('IntersectionObserver' in window)) return undefined;
    const els = IDS.map((id) => document.getElementById(id)).filter(Boolean);
    const inView = new Set();
    // A thin band across the upper-middle of the screen: the section crossing it is "current".
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? inView.add(e.target.id) : inView.delete(e.target.id)));
      const current = IDS.filter((id) => inView.has(id)).pop() ?? null;
      setActive((prev) => current ?? (window.scrollY < 200 ? null : prev));
    }, { rootMargin: '-40% 0px -55% 0px' });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [enabled]);
  return [active, setActive];
}

/** One header for every public page. On the home page the links scroll; elsewhere they go to the home page section. */
export default function Header() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useActiveSection(isHome);
  const meta = user?.user_metadata ?? {};
  const name = meta.full_name || meta.name || meta.display_name || user?.email || 'You';

  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const max = d.scrollHeight - d.clientHeight;
      setProgress(max > 0 ? d.scrollTop / max : 0);
      if (d.scrollTop < 200) setActive(null);   
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [setActive]);

  // Opening the menu: Escape closes it, the page behind stays put, a wider screen closes it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth > 900 && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey); window.addEventListener('resize', onResize);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

  const close = (id) => { if (id) setActive(id); setOpen(false); };
  const link = ({ id, label }, i, drawer) => {
    const inner = drawer ? <>{label}<small>{String(i + 1).padStart(2, '0')}</small></> : label;
    const cur = active === id ? 'true' : undefined;
    return isHome
      ? <a key={id} href={`#${id}`} aria-current={cur} onClick={() => close(id)}>{inner}</a>
      : <Link key={id} to={{ pathname: '/', hash: `#${id}` }} onClick={() => close()}>{inner}</Link>;
  };

  return (
    <header className={`lp-header${progress > 0.005 ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="lp-skip" href="#main">Skip to main content</a>
      <div className="lp-wrap lp-header__row">
        <Logo />
        <nav className="lp-nav" aria-label="Main">{NAV.map((n, i) => link(n, i, false))}</nav>
        <div className="lp-header__actions">
          {user && <ThemeToggle />}
          {authLoading ? null : user ? (
            <Link to="/home" aria-label="Open your account" title={name}><Avatar name={name} src={meta.avatar_url || meta.picture || null} size="sm" /></Link>
          ) : (
            <>
              <Link to="/login" className="lp-textlink">Log in</Link>
              <Link to="/signup" className="lp-btn lp-btn--accent lp-btn--sm">Sign up free</Link>
            </>
          )}
          <button type="button" className="lp-burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="lp-drawer" onClick={() => setOpen(!open)}><span /><span /></button>
        </div>
      </div>
      <div id="lp-drawer" className="lp-drawer" aria-hidden={!open}>
        {NAV.map((n, i) => link(n, i, true))}
        {!authLoading && (user
          ? <Link to="/home" className="lp-btn lp-btn--accent" onClick={() => close()}>Go to your account</Link>
          : <><Link to="/signup" className="lp-btn lp-btn--accent" onClick={() => close()}>Sign up free</Link><Link to="/login" className="lp-drawer__login" onClick={() => close()}>Log in</Link></>)}
      </div>
      {/* <div className="lp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" /> */}
    </header>
  );
}
