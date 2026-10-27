import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { wrap } from '../../theme/theme';

const NAV_ITEMS = [
  { label: 'Languages', href: '#languages' },
  { label: 'For speakers', href: '#speakers' },
  { label: 'Stories', href: '#stories' },
  { label: 'FAQ', href: '#faq' },
];

const SECONDARY_LINKS = [
  { label: 'Sign in', href: '/login' },
  { label: 'Get started', href: '/signup' },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* 1. Tiny utility top-bar — secondary links, razor-thin. */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          padding: '0 18px',
          background: 'rgb(var(--c-surface) / 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {SECONDARY_LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'rgb(var(--c-ink) / 0.65)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
              opacity: 0.65,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(var(--c-ink))')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(var(--c-ink) / 0.65)')}
          >
            {label}
          </a>
        ))}
      </div>


      {isMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            background: 'rgb(var(--c-surface) / 0.6)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {isMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 40,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgb(var(--c-surface) / 0.98)',
            borderTop: '1px solid rgb(var(--c-border) / 0.12)',
          }}
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            style={{
              ...wrap,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '12px 20px',
            }}
          >
            {NAV_ITEMS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 15,
                  color: 'rgb(var(--c-ink))',
                  textDecoration: 'none',
                  padding: '12px 14px',
                  borderRadius: 8,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgb(var(--c-brand) / 0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {label}
              </a>
            ))}
            <div
              style={{
                height: 1,
                backgroundColor: 'rgb(var(--c-border) / 0.12)',
                margin: '10px 0',
              }}
            />
            <Link
              to="/login"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 14,
                color: 'rgb(var(--c-ink))',
                textDecoration: 'none',
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgb(var(--c-brand))',
                color: 'rgb(var(--c-on-brand))',
                textAlign: 'center',
              }}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 14,
                color: 'rgb(var(--c-on-brand))',
                textDecoration: 'none',
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgb(var(--c-surface))',
                textAlign: 'center',
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function signedInLink() {
  const user = useAuthStore((s) => s.user);
  const signedIn = !!user;
  return signedIn ? (
    <Link
      to="/home"
      style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: 13,
        color: 'rgb(var(--c-ink))',
        textDecoration: 'none',
        padding: '10px 14px',
        borderRadius: '999px',
        border: '1px solid rgb(var(--c-border))',
        background: 'rgb(var(--c-surface))',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgb(var(--c-surface-2))')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      Profile
    </Link>
  ) : null;
}
