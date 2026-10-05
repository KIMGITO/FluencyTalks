import { photo, wrap, alpha } from '../../theme/theme';
import { Reveal } from './Reveal';

/**
 * Full-bleed photo section. On desktop the content sits on one side over a frosted-blur panel
 * that fades toward the photo. On mobile (.ft-fm) the frost covers the full width for legibility.
 * Props: img, side ('left' | 'right'), tint (a `--c-*` token name, so it follows light/dark).
 */
export default function ImageSection({
  id,
  img,
  side = 'left',
  tint = 'surface',
  minHeight = 'clamp(420px, 52vw, 560px)',
  children,
}) {
  const toward = side === 'left' ? 'right' : 'left';
  const mask = `linear-gradient(to ${toward}, #000 55%, transparent 100%)`;
  return (
    <section
      id={id}
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          ...photo(img),
          position: 'absolute',
          inset: 0,
          animation: 'ftDrift 22s ease-in-out infinite alternate',
        }}
      />
      <div
        className="ft-frost"
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [side]: 0,
          width: 'max(72%, 640px)',
          background: `linear-gradient(to ${toward}, ${alpha(tint, 0.95)} 0%, ${alpha(tint, 0.85)} 45%, ${alpha(tint, 0)} 100%)`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
      <div
        className="ft-fm"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: alpha(tint, 0.88),
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />
      <div
        style={{
          ...wrap,
          position: 'relative',
          width: '100%',
          padding: 'clamp(56px, 9vw, 96px) 24px',
          display: 'flex',
          justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
        }}
      >
        <Reveal from={side} style={{ maxWidth: 520 }}>
          {children}
        </Reveal>
      </div>
    </section>
  );
}
