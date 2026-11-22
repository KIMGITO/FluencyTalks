import clsx from 'clsx';
import { useEffect, useState } from 'react';


export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Presence dot per size, set so it sits on the circle's edge at bottom-right rather than the box corner.
const dots = { xs: 'h-2.5 w-2.5 bottom-0 right-0', sm: 'h-2.5 w-2.5 bottom-0 right-0', md: 'h-3 w-3 bottom-0 right-0', lg: 'h-4 w-4 bottom-0.5 right-0.5', xl: 'h-5 w-5 bottom-1 right-1' };
const sizes = { xs: 'h-7 w-7 text-xs', sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-base', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };
/** Always a perfect circle: fixed square box that never shrinks. Falls back to initials when there is no photo or it fails to load.
 *  no-referrer: Google profile photos (lh3.googleusercontent.com) often refuse requests that carry our referrer. */
export function Avatar({ name, src, size = 'md', online, busy, ring }: { name: string; src?: string | null; size?: keyof typeof sizes; online?: boolean; busy?: boolean; ring?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const circle = clsx('aspect-square shrink-0 rounded-full', sizes[size]);
  const inner = src && !broken
    ? <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setBroken(true)} className={clsx(circle, 'object-cover')} />
    : <span className={clsx(circle, 'flex items-center justify-center bg-brand-soft font-semibold leading-none text-ink')} aria-label={name}>{initials(name || 'U')}</span>;
  return (
    <span className="relative inline-flex shrink-0">
      {ring ? <span className="ft-avatar-ring flex">{inner}</span> : inner}
      {(online || busy) && <span title={busy ? 'On a call' : 'Online'} aria-label={busy ? 'On a call' : 'Online'} className={clsx('absolute rounded-full border-2 border-surface', dots[size], busy ? 'bg-warning' : 'bg-success')} />}
    </span>
  );
}
