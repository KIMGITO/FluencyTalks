import { Link } from 'react-router-dom';
import { C, NAME, FONT, descStyle, wrap } from '../../theme/theme';
import { footerCSS } from '../../theme/componentStyles';
import { Logo } from '@/components/ui';

/* hash = scrolls to a section on the landing page, to = router page, href = mailto/external */
const cols = [
  [
    'Product',
    [
      { label: 'How it works', hash: '#how' },
      { label: 'Languages', hash: '#languages' },
      { label: 'Help and FAQ', hash: '#faq' },
      {
        label: 'kimanthidennis02@gmail.com',
        href: 'mailto:kimanthidennis@gmail.com',
      },
    ],
  ],
];

const legal = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Data deletion', to: '/data-deletion' },
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

      {/* Main Responsive Grid Layout Container */}
      <div
        className=" grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        style={wrap}
      >
        {/* Col 1: Brand & Logo Panel */}
        <div className="ft-fbrand flex flex-col gap-4">
          <Logo light />
          <p
            className="max-w-[300px] leading-relaxed text-sm opacity-90"
            style={{ font: FONT }}
          >
            Practice any language by talking with the people who speak it.
          </p>
        </div>

        {/* Col 2: Dynamic Navigation Lists */}
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

        <div className='w-full md:col-span-2 lg:col-span-1'>
          <h3
              className="text-base font-extrabold uppercase tracking-wider"
              style={{ color: C.sun }}
            >
              Description
            </h3>
          <div
            className="ft-fdesc m-0 text-sm leading-relaxed opacity-80 "
            style={descStyle}
          >
            FluencyTalks connects language learners, expats, and students with
            native and fluent speakers for real-world conversation. Practice
            your target language, send text messages, receive real-time peer
            corrections, and build your personalized phrasebook to fast-track
            your journey to true fluency.
          </div>
        </div>
      </div>

      {/* Bottom Horizontal Attribution/Legal Utility Bar */}
      <div
        className="ft-fbar flex flex-col gap-4 border-t border-white/15 pt-5 text-sm sm:flex-row sm:justify-between sm:items-center"
        style={{
          ...wrap,
          marginTop: 'clamp(28px, 4vw, 40px)',
        }}
      >
        <span>
          © {new Date().getFullYear()} {NAME}. All rights reserved.
        </span>
        <span className="flex items-center gap-5">
          {legal.map((l) => (
            <Link
              key={l.label}
              className="ft-flink transition-colors duration-200 hover:text-white"
              to={l.to}
            >
              {l.label}
            </Link>
          ))}
        </span>
      </div>
    </footer>
  );
}
