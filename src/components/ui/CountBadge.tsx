import clsx from 'clsx';

/**
 * Red pill with a number, for "something new here". Hidden at 0. The ring separates it from whatever it
 * sits on (pass the background's ring class). Text uses the surface colour: white on red in light, dark
 * on the lighter red in dark, so both themes stay readable.
 */
export function CountBadge({ count, label, ring = 'ring-bg', className }: { count: number; label: string; ring?: string; className?: string }) {
  if (!count) return null;
  return (
    <span aria-label={`${count} ${label}`} className={clsx(
      'pointer-events-none absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-surface ring-2',
      ring, className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
