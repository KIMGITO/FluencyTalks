import { C, IMG, h2 } from '../../theme/theme';
import ImageSection from './ImageSection';
const items = [
  [
    'Inline corrections',
    'See the right form straight away, right where you made the mistake.',
    C.coral,
  ],
  [
    'Phrasebook',
    'Save new words and phrases and review them whenever you like.',
    C.teal,
  ],
  [
    'Daily streaks',
    'Short, friendly reminders that turn practice into a habit.',
    C.sun,
  ],
];
export default function Features() {
  return (
    <ImageSection img={IMG.online} side="right" tint="deep" minHeight={560}>
      <h2 style={{ ...h2, color: C.sun }}>
        Everything you need to keep going
      </h2>
      {/* Flex column — a one-column grid adds nothing here, and flex keeps the
          buttons at their natural height across every breakpoint. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 28 }}>
        {items.map(([t, d, c]) => (
          <div
            key={t}
            className="ft-lift"
            style={{ borderLeft: `6px solid ${c}`, paddingLeft: 18 }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, color: c }}>{t}</div>
            <div style={{ color: 'rgba(255,255,255,0.88)' }}>{d}</div>
          </div>
        ))}
      </div>
    </ImageSection>
  );
}
