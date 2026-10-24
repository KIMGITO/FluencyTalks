import { photo, wrap, alpha } from '../../theme/theme';
import { Reveal } from './Reveal';


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
