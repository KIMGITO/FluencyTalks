import { C, IMG, SERIF } from './theme';
import ImageSection from './ImageSection';
export default function Testimonial() {
  return (
    <ImageSection id="stories" img={IMG.team} side="left" tint="#fff0ea" minHeight={560}>
      <div style={{ fontFamily: SERIF, fontSize: 90, lineHeight: 0.6, color: C.coral }}>“</div>
      <p style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.4, margin: '0 0 22px', color: C.ink }}>
        I studied French for years and froze when I spoke. Three weeks of chats with Camille and I finally ordered dinner in Paris without panic.
      </p>
      <div style={{ fontWeight: 800 }}>Amina Odhiambo</div>
      <div style={{ color: C.muted }}>Learning French, member since 2025</div>
    </ImageSection>
  );
}
