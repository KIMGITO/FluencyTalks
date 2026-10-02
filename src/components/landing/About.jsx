import { Link } from 'react-router-dom';
import { C, IMG, h2, lead, btn } from './theme';
import ImageSection from './ImageSection';
export default function About() {
  return (
    <ImageSection img={IMG.friends} side="left" tint="#ffffff" minHeight={600}>
      <h2 style={h2}>Apps teach you words. People teach you to talk.</h2>
      <p style={{ ...lead, marginBottom: 20, color: C.ink }}>Flashcards only go so far. Fluency comes from real conversations with someone patient, curious and happy to help.</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 12, fontWeight: 700 }}>
        {[['Native and fluent speakers, matched to you', C.coral], ['Corrections right inside the chat', C.teal], ['Text, voice and video, whenever you like', C.sun]].map(([t, c]) => (
          <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ width: 14, height: 14, borderRadius: '50%', background: c, flex: 'none' }} />{t}</li>
        ))}
      </ul>
      <Link to="/signup" style={btn(C.indigo, C.white)}>Find a partner</Link>
    </ImageSection>
  );
}
