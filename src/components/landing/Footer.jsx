import { Link } from 'react-router-dom';
import { C, NAME, FONT, wrap } from '../../theme/theme';
import { footerCSS } from '../../theme/componentStyles';
import { Logo } from '@/components/ui';
import { EMAILS, mailto } from '@/lib/emails';
import { SUPPORT_SUBJECT } from '@/lib/site';


const cols = [
  [
    'Explore',
    [
      { label: 'Languages', hash: '#languages' },
      { label: 'For speakers', hash: '#speakers' },
      { label: 'Member stories', hash: '#stories' },
      { label: 'Help and FAQ', hash: '#faq' },
    ],
  ],
  [
    'Get started',
    [
      { label: 'Create a free account', to: '/signup' },
      { label: 'Log in', to: '/login' },
      { label: 'Find a partner', to: '/search' },
      { label: 'How conversations work', hash: '#speakers' },
    ],
  ],
  [
    'Trust & legal',
    [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Data deletion', to: '/data-deletion' },
    ],
  ],
];

function FooterLink({ label, to, hash, href }) {
  if (to)
    return (
      <Link
        className="ft-flink transition-colors duration-200 hover:text-white"
        to={to}
      >
        {label}
      </Link>
    );
  return (
    <a
      className="ft-flink transition-colors duration-200 hover:text-white"
      href={hash || href}
    >
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer
      style={{
        background: C.deep,
        color: 'rgba(255,255,255,0.8)',
        padding: 'clamp(44px, 7vw, 64px) 0 20px',
        fontSize: 15,
      }}
    >
      <style>{footerCSS}</style>

      <div className="ft-foot" style={wrap}>
        <div className="ft-fbrand flex flex-col gap-4">
          <Logo light />
          <p
            className="max-w-[300px] leading-relaxed text-sm opacity-90"
            style={{ font: FONT }}
          >
            Practice any language by talking with the people who speak it.
          </p>
          <div className="mt-1 flex flex-col gap-1.5 text-sm">
            <span
              className="text-xs font-extrabold uppercase tracking-wider"
              style={{ color: C.sun }}
            >
              Talk to us
            </span>
            <a
              className="ft-flink transition-colors duration-200 hover:text-white"
              href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}
            >
              {EMAILS.support}
            </a>
          </div>
        </div>

        {cols.map(([heading, links]) => (
          <nav
            key={heading}
            aria-label={heading}
            className="flex flex-col gap-4"
          >
            <h3
              className="text-base font-extrabold uppercase tracking-wider"
              style={{ color: C.sun }}
            >
              {heading}
            </h3>
            <ul className="m-0 flex flex-col gap-2.5 p-0 list-none">
              {links.map((l) => (
                <li key={l.label}>
                  <FooterLink {...l} />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div
        className="ft-fbar border-t border-white/15 pt-5 text-sm"
        style={{
          ...wrap,
          marginTop: 'clamp(28px, 4vw, 40px)',
        }}
      >
        <span>
          © {new Date().getFullYear()} {NAME}. All rights reserved.
        </span>
        <span className="flex items-center gap-5">
          <Link
            className="ft-flink transition-colors duration-200 hover:text-white"
            to="/privacy"
          >
            Privacy
          </Link>
          <Link
            className="ft-flink transition-colors duration-200 hover:text-white"
            to="/terms"
          >
            Terms
          </Link>
        </span>
      </div>
    </footer>
  );
}
