import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { C, NAME, SERIF, wrap, btn } from './theme';
import { Logo, Card } from '@/components/ui';




const nav = [
  ['How it works', '#how'],
  ['Languages', '#languages'],
  ['For speakers', '#speakers'],
  ['Stories', '#stories'],
  ['FAQ', '#faq'],
];

export default function Header() {
  const [sp, setSp] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => {
      const h = document.documentElement;
      setSp(h.scrollTop / (h.scrollHeight - h.clientHeight || 1));
    };
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: 4,
          width: `${sp * 100}%`,
          background: `linear-gradient(90deg, ${C.coral}, ${C.sun}, ${C.teal})`,
          zIndex: 30,
        }}
      />

      <header
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          boxShadow:
            sp > 0.01 || open
              ? '0 6px 24px rgba(43,42,122,0.15)'
              : '0 2px 0 rgba(43,42,122,0.08)',
          transition: 'box-shadow .3s',
        }}
      >
        <div
          style={{
            ...wrap,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 24px',
          }}
        >
          <Logo />
          <nav
            className="ft-nav ft-desk"
            style={{ display: 'flex', gap: 22, fontWeight: 700, fontSize: 15 }}
          >
            {nav.map(([l, h]) => (
              <a
                key={l}
                href={h}
                style={{ color: C.ink, textDecoration: 'none' }}
              >
                {l}
              </a>
            ))}
          </nav>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link
              className="ft-desk"
              to="/login"
              style={btn('transparent', C.indigo, {
                padding: '10px 20px',
                borderColor: C.indigo,
              })}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              style={btn(C.indigo, C.white, {
                padding: '10px 20px',
                fontSize: 15,
              })}
            >
              Sign up free
            </Link>
            <button
              className="ft-burger"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {open && (
          <nav
            className="ft-burger-menu"
            style={{
              ...wrap,
              padding: '4px 24px 20px',
              animation: 'ftUp .3s both',
            }}
          >
            {nav.concat([['Log in', '/login']]).map(([l, h], i, a) => (
              <a
                key={l}
                href={h}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '14px 0',
                  fontWeight: 700,
                  fontSize: 17,
                  color: l === 'Log in' ? C.coral : C.ink,
                  textDecoration: 'none',
                  borderBottom: i < a.length - 1 ? `1px solid ${C.sky}` : 0,
                }}
              >
                {l}
              </a>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
