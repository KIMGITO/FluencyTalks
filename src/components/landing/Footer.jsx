import { Link } from 'react-router-dom';
import { C, NAME, wrap } from './theme';
import { Logo } from '@/components/ui';


/* hash = scrolls to a section on the landing page, to = router page, href = mailto/external */
const cols = [
  ['Product', [
    { label: 'How it works', hash: '#how' },
    { label: 'Languages', hash: '#languages' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Voice rooms', to: '/signup' },
  ]],
  ['Community', [
    { label: 'Become a speaker', hash: '#speakers' },
    { label: 'Guidelines', to: '/guidelines' },
    { label: 'Safety', to: '/safety' },
    { label: 'Blog', to: '/blog' },
  ]],
  ['Company', [
    { label: 'About us', to: '/about' },
    { label: 'Careers', to: '/careers' },
    { label: 'Help and FAQ', hash: '#faq' },
    { label: 'help@fluencytalks.com', href: 'mailto:help@fluencytalks.com' },
  ]],
];

const legal = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
];

const CSS = `
.ft-foot{display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:clamp(28px,4vw,56px)}
.ft-flink{display:inline-block;padding:6px 0;color:rgba(255,255,255,.78);text-decoration:none;overflow-wrap:anywhere;transition:color .2s,transform .2s}
.ft-flink:hover{color:#ffc83d;transform:translateX(3px)}
.ft-fbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px 24px}
@media(max-width:900px){.ft-foot{grid-template-columns:repeat(3,1fr)}.ft-fbrand{grid-column:1/-1}}
@media(max-width:560px){.ft-foot{grid-template-columns:repeat(2,1fr);gap:32px 20px}.ft-fbar{flex-direction:column-reverse;text-align:center}}`;

function FooterLink({ label, to, hash, href }) {
  if (to) return <Link className="ft-flink" to={to}>{label}</Link>;
  return <a className="ft-flink" href={hash || href}>{label}</a>;
}

export default function Footer() {
  return (
    <footer style={{ background: C.deep, color: 'rgba(255,255,255,0.8)', padding: 'clamp(44px, 7vw, 64px) 0 20px', fontSize: 15 }}>
      <style>{CSS}</style>

      <div className="ft-foot" style={wrap}>
        <div className="ft-fbrand">
          <Logo light />
          <p style={{ margin: '16px 0 0', maxWidth: 300, lineHeight: 1.65 }}>Practice any language by talking with the people who speak it.</p>
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