import { C, NAME, wrap, grid } from './theme';
import { Logo } from './Header';
const cols = [['Product', ['How it works', 'Languages', 'Pricing', 'Voice rooms']], ['Community', ['Become a speaker', 'Guidelines', 'Safety', 'Blog']], ['Company', ['About us', 'Careers', 'help@fluencytalks.com', 'Privacy and terms']]];
export default function Footer() {
  return (
    <footer style={{ background: C.deep, color: 'rgba(255,255,255,0.8)', padding: 'clamp(44px, 7vw, 64px) 0 24px' }}>
      <div style={{ ...wrap, ...grid(150, 28) }}>
        <div className="ft-span"><Logo light /><p style={{ marginTop: 16, maxWidth: 280 }}>Practice any language by talking with the people who speak it.</p></div>
        {cols.map(([h, items], i) => (
          <div key={h}>
            <div style={{ color: [C.sun, C.coral, C.teal][i], fontWeight: 800, marginBottom: 14 }}>{h}</div>
            <div style={{ display: 'grid', gap: 8 }}>{items.map((t) => <span key={t}>{t}</span>)}</div>
          </div>
        ))}
      </div>
      <div style={{ ...wrap, marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 14 }}>© 2026 {NAME}. All rights reserved.</div>
    </footer>
  );
}
