import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { C, wrap, btn } from '../../theme/theme';
import { Logo } from '@/components/ui';

// Navigation links configuration
const NAV_ITEMS = [
  { label: 'How it works', href: '#how' },
  { label: 'Languages', href: '#languages' },
  { label: 'For speakers', href: '#speakers' },
  { label: 'Stories', href: '#stories' },
  { label: 'FAQ', href: '#faq' },
];

export default function Header() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track scroll progress for top indicator bar
  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const totalHeight = doc.scrollHeight - doc.clientHeight;
      setScrollProgress(totalHeight > 0 ? doc.scrollTop / totalHeight : 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Monitor viewport width for responsive micro-adjustments
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Lock body scroll on iOS/Mobile when dropdown menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Close menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const isScrolled = scrollProgress > 0.01;

  return (
    <>
      {/* Top Scroll Indicator Line */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          width: `${scrollProgress * 100}%`,
          background: `linear-gradient(90deg, ${C.coral}, ${C.sun}, ${C.teal})`,
          zIndex: 50,
          transition: 'width 0.1s linear',
        }}
      />

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${
            isScrolled || isMenuOpen
              ? 'rgba(43,42,122,0.12)'
              : 'rgba(43,42,122,0.06)'
          }`,
          boxShadow:
            isScrolled || isMenuOpen
              ? '0 10px 30px -10px rgba(43,42,122,0.12)'
              : '0 2px 8px -2px rgba(43,42,122,0.04)',
          transition: 'all 0.25s ease-in-out',
        }}
      >
        <div
          style={{
            ...wrap,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isMobile ? '8px' : '16px',
            padding: isMobile ? '10px 16px' : '12px 24px',
          }}
        >
          {/* Brand Logo */}
          <Link
            to="/"
            style={{ textDecoration: 'none' }}
            aria-label="FluencyTalks Home"
          >
            <Logo />
          </Link>

          {/* Desktop Navigation */}
          <nav
            className="ft-nav ft-desk"
            aria-label="Main Navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              fontWeight: 600,
              fontSize: '15px',
            }}
          >
            {NAV_ITEMS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{
                  color: C.ink,
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.indigo)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.ink)}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Action Buttons & Hamburger Toggle */}
          <div
            style={{
              display: 'flex',
              gap: isMobile ? '8px' : '12px',
              alignItems: 'center',
            }}
          >
            <Link
              className="ft-desk"
              to="/login"
              style={btn('transparent', C.indigo, {
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '8px',
                border: `1.5px solid ${C.indigo}`,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              })}
            >
              Log in
            </Link>

            <Link
              to="/signup"
              style={btn(C.indigo, C.white, {
                padding: isMobile ? '8px 14px' : '9px 18px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '600',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(43, 42, 122, 0.2)',
                transition: 'all 0.2s ease',
              })}
            >
              {isMobile ? 'Sign up' : 'Sign up free'}
            </Link>

            {/* Mobile Touch-Optimized Hamburger Button */}
            <button
              className="ft-burger"
              aria-label={
                isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
              }
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '8px',
                border: `1px solid ${isMenuOpen ? C.indigo : 'rgba(43,42,122,0.12)'}`,
                background: isMenuOpen ? 'rgba(43,42,122,0.06)' : 'transparent',
                color: C.ink,
                fontSize: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {isMenuOpen && (
          <div
            id="mobile-navigation"
            aria-label="Mobile Navigation"
            style={{
              borderTop: '1px solid rgba(43,42,122,0.08)',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 24px -6px rgba(43,42,122,0.12)',
              animation: 'ftDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <nav
              style={{
                ...wrap,
                padding: '12px 16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {NAV_ITEMS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '16px',
                    color: C.ink,
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      'rgba(43,42,122,0.04)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <span>{label}</span>
                  <span style={{ fontSize: '14px', opacity: 0.4 }}>→</span>
                </a>
              ))}

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'rgba(43,42,122,0.08)',
                  margin: '8px 0 12px',
                }}
              />

              {/* Internal Route Link for Mobile Log in */}
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '15px',
                  color: C.indigo,
                  border: `1.5px solid ${C.indigo}`,
                  textDecoration: 'none',
                  textAlign: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                Log in
              </Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}