import { Link } from 'react-router-dom';
import { C, IMG, wrap, h2, lead, btn, photo, alpha } from '../../theme/theme';
import { Reveal } from './Reveal';
import { useJoinLink } from './useJoinLink';
export default function Cta() {
  const join = useJoinLink();
  return (
    <section style={{ ...photo(IMG.talk), position: 'relative', textAlign: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(120deg, ${alpha('accent', 0.93)}, ${alpha('brand', 0.93)})` }} />
      <div style={{ ...wrap, position: 'relative', padding: 'clamp(56px, 9vw, 96px) 24px' }}>
        <Reveal>
          <h2 style={{ ...h2, color: C.white, fontSize: 'clamp(30px, 5vw, 50px)' }}>Ready for your first conversation?</h2>
          <p style={{ ...lead, color: C.white, margin: '0 auto 30px' }}>
            {join.signedIn ? 'Jump back in and keep your streak going.' : 'Create a free account and message someone today.'}
          </p>
          <Link to={join.to} style={btn(C.sun, C.ink)}>{join.label}</Link>
        </Reveal>
      </div>
    </section>
  );
}
