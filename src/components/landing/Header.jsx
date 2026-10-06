import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { C, wrap, btn } from '../../theme/theme';
import { Avatar, Logo, ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

// Navigation links configuration
const NAV_ITEMS = [
  // { label: 'How it works', href: '#how' },
  { label: 'Languages', href: '#languages' },
  { label: 'For speakers', href: '#speakers' },
  { label: 'Stories', href: '#stories' },
  { label: 'FAQ', href: '#faq' },
];

/** Where the profile tab goes: straight into the app home. The profile store is
 *  only populated inside ProtectedRoute, so we deliberately don't depend on it here. */
function ProfileLink({ className, style, children, onClick }) {
  return (
    <Link to="/home" onClick={onClick} className={className} style={style}>
      {children}
    </Link>
  );
}

/** Best available label/photo for the session, before the profile loads. */
function useSessionIdentity(user) {
  const meta = user?.user_metadata ?? {};
  return {
    name: meta.full_name || meta.name || meta.display_name || user?.email || 'You',
    src: meta.avatar_url || meta.picture || null,
  };
}

export default function Header() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Session-aware: signed-in members are offered their profile, never a login form.
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const identity = useSessionIdentity(user);
  const signedIn = !!user;

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
          background: ` ${C.indigo}`,
          zIndex: 50,
          transition: 'width 0.1s linear',
        }}
      />

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgb(var(--c-surface) / 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${
            isScrolled || isMenuOpen
              ? 'rgb(var(--c-brand) / 0.14)'
              : 'rgb(var(--c-brand) / 0.08)'
          }`,
          boxShadow:
            isScrolled || isMenuOpen
              ? '0 10px 30px -10px rgb(var(--c-brand) / 0.14)'
              : '0 2px 8px -2px rgb(var(--c-brand) / 0.05)',
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
              gap: isMobile ? '8px' : '10px',
              alignItems: 'center',
            }}
          >
            {/* Signed out: log in + sign up. Signed in: one profile tab that
                takes the member home, so they are never asked to log in again. */}
            {authLoading ? null : signedIn ? (
              <ProfileLink
                className="ft-desk"
                style={btn('transparent', C.indigo, {
                  padding: '2px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                })}
              >
                <Avatar
                  name={identity.name}
                  src={identity.src}
                  size="sm"
                />
              </ProfileLink>
            ) : (
              <>
                <Link
                  className="ft-desk"
                  to="/login"
                  style={btn('transparent', C.indigo, {
                    padding: '7px 16px',
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
                    padding: isMobile ? '7px 13px' : '8px 16px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgb(var(--c-brand) / 0.2)',
                    transition: 'all 0.2s ease',
                  })}
                >
                  {isMobile ? 'Sign up' : 'Sign up free'}
                </Link>
              </>
            )}

            {signedIn && <ThemeToggle />}

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
                border: `1px solid ${isMenuOpen ? C.indigo : 'rgb(var(--c-brand) / 0.12)'}`,
                background: isMenuOpen ? 'rgb(var(--c-brand) / 0.06)' : 'transparent',
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
              borderTop: '1px solid rgb(var(--c-brand) / 0.08)',
              background: 'rgb(var(--c-surface) / 0.98)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 24px -6px rgb(var(--c-brand) / 0.12)',
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
                      'rgb(var(--c-brand) / 0.04)')
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
                  backgroundColor: 'rgb(var(--c-brand) / 0.08)',
                  margin: '8px 0 12px',
                }}
              />

              {/* Mobile account action — profile tab for members, log in for guests */}
              {authLoading ? null : signedIn ? (
                <ProfileLink
                  onClick={() => setIsMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '15px',
                    color: C.ink,
                    border: `1.5px solid ${C.indigo}`,
                    textDecoration: 'none',
                    backgroundColor: 'rgb(var(--c-brand) / 0.04)',
                  }}
                >
                  <Avatar
                    name={identity.name}
                    src={identity.src}
                    size="sm"
                  />
                  Go to my profile
                </ProfileLink>
              ) : (
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
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}