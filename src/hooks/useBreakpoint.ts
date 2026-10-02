import { useEffect, useState } from 'react';
import { breakpoints } from '@/theme/tokens';
export type Bp = 'mobile' | 'tablet' | 'desktop';
const calc = (): Bp => (innerWidth >= breakpoints.lg ? 'desktop' : innerWidth >= breakpoints.md ? 'tablet' : 'mobile');
/** Use only when JS must differ per size; prefer Tailwind responsive classes. */
export function useBreakpoint() {
  const [bp, setBp] = useState<Bp>(calc);
  useEffect(() => { const f = () => setBp(calc()); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  return bp;
}
