import { Link } from 'react-router-dom';
import { C, IMG, h2, lead, btn } from '../../theme/theme';
import ImageSection from './ImageSection';
import { ArrowRight } from 'lucide-react';
import { useJoinLink } from './useJoinLink';
export default function About() {
  const join = useJoinLink();
  return (
    <ImageSection img={IMG.friends} side="right" tint="surface" minHeight={600}>
      {/* Flex column, not a grid: these are stacked text blocks. */}
      <div className="flex flex-col gap-6">
        <h2 style={h2}>
          Apps teach you words.{' '}
          <span style={{ color: C.teal }}>People teach you to talk</span>.
        </h2>
        <p style={{ ...lead, marginBottom: 20, color: C.ink }}>
          Flashcards only go so far. Fluency comes from real conversations with
          someone patient, curious and happy to help.
        </p>
        <Link to={join.to} className="flex justify-center text-center" style={btn(C.indigo, C.white)}>
          {join.signedIn ? 'Back to my profile' : 'Find a partner'}
        </Link>
      </div>
    </ImageSection>
  );
}
