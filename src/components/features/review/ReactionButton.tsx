import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

type Tone = 'brand' | 'accent' | 'success' | 'warning' | 'quiet';
/** confetti: someone was thanked or accepted. sparks: a small yes. ring: kept something. none: the icon only moves. */
type Burst = 'confetti' | 'sparks' | 'ring' | 'none';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-soft text-ink',
  accent: 'bg-accent/15 text-ink [&_svg]:text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  quiet: 'bg-surface-2 text-ink',
};
const PIECES = ['accent', 'aqua', 'warning', 'brand', 'success'];

/** The number slides in from the direction it moved. Nothing moves on first paint. */
function RollingCount({ value }: { value: number }) {
  const [seen, setSeen] = useState<{ value: number; dir: 'up' | 'down' | null }>({ value, dir: null });
  if (seen.value !== value) setSeen({ value, dir: value > seen.value ? 'up' : 'down' });
  if (value <= 0) return null;
  return (
    <span className="ft-count">
      <span key={value} className={seen.dir ? `ft-count-${seen.dir}` : undefined}>{value}</span>
    </span>
  );
}

/** One action under a comment: an icon, an optional count, and a reaction the moment it turns on. */
export function ReactionButton({ icon: Icon, activeIcon, label, ariaLabel, wideLabelOnly = true, count, active = false, filled = true, tone = 'brand', burst = 'none', disabled, expanded, onClick }: {
  icon: LucideIcon;
  activeIcon?: LucideIcon;
  label: string;
  ariaLabel?: string;
  /** Phones show only the icon, so a row of five still fits. */
  wideLabelOnly?: boolean;
  count?: number;
  active?: boolean;
  filled?: boolean;
  tone?: Tone;
  burst?: Burst;
  disabled?: boolean;
  /** For a button that opens something: says so instead of "pressed". */
  expanded?: boolean;
  onClick?: () => void;
}) {
  const [fired, setFired] = useState(0);
  const was = useRef(active);
  // Fires on turning on, so it also follows a server answer, and stays quiet on load and on a rollback.
  useEffect(() => {
    if (active && !was.current) setFired((n) => n + 1);
    was.current = active;
  }, [active]);
  const Shown = active && activeIcon ? activeIcon : Icon;
  const pieces = burst === 'confetti' ? 14 : burst === 'sparks' ? 7 : 0;

  return (
    <button type="button" disabled={disabled} title={label} aria-label={ariaLabel ?? label} onClick={onClick}
      {...(expanded === undefined ? { 'aria-pressed': active } : { 'aria-expanded': expanded })}
      className={clsx('ft-reaction inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', active ? TONES[tone] : 'text-muted', !active && !disabled && 'hover:bg-surface-2 hover:text-ink')}>
      <span className="relative inline-flex">
        <span key={fired} className={clsx('inline-flex', fired > 0 && 'ft-react-pop')}>
          <Shown size={16} aria-hidden className={clsx(active && filled && 'fill-current')} />
        </span>
        {fired > 0 && (
          <span key={`fx-${fired}`} className={clsx('ft-burst', burst === 'confetti' && 'ft-burst-wide')} aria-hidden>
            {burst !== 'none' && <span className="ft-burst-ring" />}
            {Array.from({ length: pieces }, (_, i) => (
              <span key={i} className="ft-burst-piece" style={{ '--a': `${(360 / pieces) * i + (i % 2) * 11}deg`, '--c': `var(--c-${PIECES[i % PIECES.length]})`, animationDelay: `${(i % 3) * 25}ms` } as CSSProperties} />
            ))}
          </span>
        )}
      </span>
      <span className={clsx(wideLabelOnly && 'hidden sm:inline')}>{label}</span>
      {count !== undefined && <RollingCount value={count} />}
    </button>
  );
}
