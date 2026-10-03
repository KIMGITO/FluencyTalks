import { C, SERIF, wrap } from '../../theme/theme';
import { Reveal, Count } from './Reveal';

// [value, suffix, decimals, long label, short label]
const stats = [
  [40, '+', 0, 'Languages to practice', 'Languages'],
  [120, 'k', 0, 'Conversations a month', 'Chats / month'],
  [85, '', 0, 'Countries represented', 'Countries'],
  [4.8, '/5', 1, 'Average session rating', 'Avg. rating'],
];

const CSS = `
.ft-st-short{display:none}
@media(max-width:600px){.ft-st-long{display:none}.ft-st-short{display:inline}}`;

export default function Stats() {
  return (
    <section
      style={{
        ...wrap,
        marginTop: 'calc(-1 * clamp(20px, 2vw, 30px))',
        position: 'relative',
        zIndex: 0,
      }}
    >
      <style>{CSS}</style>
      <Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            borderRadius: 'clamp(16px, 3vw, 24px)',
            overflow: 'hidden',
            background: `linear-gradient(110deg, ${C.sun} 0%, #ffd45f 50%, #ffb84d 100%)`,
            boxShadow: '0 14px 32px rgba(43,42,122,0.22)',
          }}
        >
          {stats.map(([to, suf, dec, long, short], i) => (
            <div
              key={long}
              style={{
                padding: 'clamp(12px, 3vw, 26px) clamp(4px, 1.2vw, 12px)',
                textAlign: 'center',
                borderLeft: i ? '1px solid rgba(27,26,85,0.14)' : 0,
              }}
            >
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 'clamp(20px, 5.4vw, 38px)',
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: C.deep,
                }}
              >
                <Count to={to} suffix={suf} dec={dec} />
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontWeight: 700,
                  fontSize: 'clamp(10px, 1.7vw, 16px)',
                  lineHeight: 1.25,
                  color: C.ink,
                  opacity: 0.85,
                }}
              >
                <span className="ft-st-long">{long}</span>
                <span className="ft-st-short">{short}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
