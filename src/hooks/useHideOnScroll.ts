import { useEffect, useState } from 'react';

/**
 * True while the user is scrolling down the page (away from the top), false as soon as
 * they scroll back up, reach the top, or near the bottom. Small jitters are ignored, so
 * the bar doesn't flicker on slow drags or iOS rubber-banding.
 */
export function useHideOnScroll({ threshold = 10, topOffset = 64 } = {}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let travel = 0; // distance moved in the current direction
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      if (y < topOffset || atBottom) { travel = 0; setHidden(false); return; }
      if (delta === 0) return;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > threshold) setHidden(true);
      else if (travel < -threshold) setHidden(false);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [threshold, topOffset]);

  return [hidden, setHidden] as const;
}
