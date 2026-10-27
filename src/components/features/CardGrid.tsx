import { ReactNode } from 'react';

/**
 * Institutional two-column main layout: narrow left rail for text filters /
 * category lists, and a wide right column for cards.
 *
 * Usage:
 *   <CardGrid left={<Filters />} right={<Cards />} />
 */
export function CardGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="lg-main">
      <div className="ft-left">{left}</div>
      <div className="ft-right">{right}</div>
    </div>
  );
}
