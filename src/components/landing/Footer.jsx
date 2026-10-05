import { Link } from 'react-router-dom';
import { C, NAME,FONT, wrap } from '../../theme/theme';
import { footerCSS } from '../../theme/componentStyles';
import { Logo } from '@/components/ui';


/* hash = scrolls to a section on the landing page, to = router page, href = mailto/external */
const cols = [
  ['Product', [
    { label: 'How it works', hash: '#how' },
    { label: 'Languages', hash: '#languages' },
     { label: 'Help and FAQ', hash: '#faq' },
     { label: 'kimanthidennis02@gmail.com', href: 'mailto:kimanthidennis@gmail.com' },
  ]],
  
];

const legal = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Data deletion', to: '/data-deletion' },
];


function FooterLink({ label, to, hash, href }) {
  if (to) return <Link className="ft-flink" to={to}>{label}</Link>;
  return <a className="ft-flink" href={hash || href}>{label}</a>;
}

export default function Footer() {
  return (
    <footer style={{ background: C.deep, color: 'rgba(255,255,255,0.8)', padding: 'clamp(44px, 7vw, 64px) 0 20px', fontSize: 15 }}>
      <style>{footerCSS}</style>

      <div className="ft-foot" style={wrap}>
        <div className="ft-fbrand">
          <Logo light />
          <p style={{ margin: '16px 0 0', maxWidth: 300, lineHeight: 1.65, font: FONT }}>Practice any language by talking with the people who speak it.</p>
        </div>

        {cols.map(([heading, links]) => (
          <nav key={heading} aria-label={heading}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, letterSpacing: '0.04em', color: C.sun }}>{heading}</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {links.map((l) => <li key={l.label}><FooterLink {...l} /></li>)}
            </ul>
          </nav>
        ))}
      </div>

      <div className="ft-fbar" style={{ ...wrap, marginTop: 'clamp(28px, 4vw, 40px)', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 14 }}>
        <span>© {new Date().getFullYear()} {NAME}. All rights reserved.</span>
        <span style={{ display: 'flex', gap: 20 }}>
          {legal.map((l) => <Link key={l.label} className="ft-flink" to={l.to}>{l.label}</Link>)}
        </span>
      </div>
    </footer>
  );
}