import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, MoreVertical, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button, Card } from '@/components/ui';

/** Solid brand colours, each with the text colour that stays readable on it in both themes. */
const SOLID = {
  brand: 'bg-brand text-on-brand', accent: 'bg-accent text-deep', aqua: 'bg-aqua text-deep', sun: 'bg-sun text-deep',
  success: 'bg-success text-surface', danger: 'bg-danger text-surface', muted: 'bg-surface-2 text-ink',
};
export type Tone = keyof typeof SOLID;
const SOFT: Record<Tone, string> = {
  brand: 'bg-brand-soft text-ink', accent: 'bg-accent/15 text-ink', aqua: 'bg-aqua/15 text-ink', sun: 'bg-sun/25 text-ink',
  success: 'bg-success/10 text-success', danger: 'bg-danger/10 text-danger', muted: 'bg-surface-2 text-muted',
};

export const IconTile = ({ icon: Icon, tone = 'muted', small }: { icon: LucideIcon; tone?: Tone; small?: boolean }) => (
  <span aria-hidden className={clsx('flex shrink-0 items-center justify-center rounded-md', small ? 'h-8 w-8' : 'h-10 w-10', SOLID[tone])}><Icon size={small ? 16 : 20} /></span>
);

/** A small state label. Always words, with an icon where it helps: colour alone never carries the meaning. */
export const Chip = ({ tone = 'muted', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) => (
  <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-bold', SOFT[tone])}>{Icon && <Icon size={13} aria-hidden />}{children}</span>
);

export const Meter = ({ percent, tone = 'brand', label }: { percent: number; tone?: Tone; label: string }) => (
  <span role="meter" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
    <span className={clsx('block h-full rounded-full transition-[width] duration-500', SOLID[tone])} style={{ width: `${Math.min(100, Math.max(percent ? 2 : 0, percent))}%` }} />
  </span>
);

/** One number worth a glance. With `to` the whole tile is a link. Keeps its own corners on phones, where other cards run edge to edge. */
export function StatTile({ label, value, hint, icon, tone, to, meter, delay = 0 }: { label: string; value: number | string; hint?: string; icon: LucideIcon; tone: Tone; to?: string; meter?: { percent: number; label: string }; delay?: number }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-muted">{label}</span><IconTile icon={icon} tone={tone} small /></span>
      <span className="mt-1 block font-display text-3xl font-medium tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      {meter && <span className="mt-2 block"><Meter percent={meter.percent} tone={tone} label={meter.label} /></span>}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </>
  );
  const cls = 'ft-card ft-card-pad ft-rise block !rounded-lg !border';
  const style = { animationDelay: `${delay}ms` };
  return to ? <Link to={to} className={clsx(cls, 'ft-lift')} style={style}>{body}</Link> : <div className={cls} style={style}>{body}</div>;
}

/** A card with a titled header. `pad={false}` for lists that draw their own rows. */
export const Panel = ({ title, icon, tone = 'muted', count, action, note, pad = true, children }: { title: string; icon?: LucideIcon; tone?: Tone; count?: number; action?: ReactNode; note?: string; pad?: boolean; children: ReactNode }) => (
  <Card pad={false}>
    <header className="flex flex-wrap items-center gap-2.5 border-b border-border px-3 py-3 md:px-4">
      {icon && <IconTile icon={icon} tone={tone} small />}
      <h2 className="min-w-0 flex-1 font-display text-xl font-medium leading-tight">{title}{count !== undefined && <span className="ml-2 font-sans text-sm font-bold tabular-nums text-muted">{count}</span>}</h2>
      {action}
      {note && <p className="w-full text-xs text-muted">{note}</p>}
    </header>
    <div className={clsx(pad && 'ft-card-pad')}>{children}</div>
  </Card>
);

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={clsx('flex items-center justify-between gap-3 py-1 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <span className="min-w-0"><span className="block font-semibold">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden className={clsx('block h-6 w-10 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent', checked ? 'bg-success' : 'bg-border')} />
        <span aria-hidden className={clsx('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition-transform', checked && 'translate-x-4')} />
      </span>
    </label>
  );
}

export interface MenuAction { label: string; icon?: LucideIcon; danger?: boolean; disabled?: boolean; onSelect: () => void }

/** A dropdown of actions: a kebab button, or a labelled one with `text`. Closes on a tap outside or Escape, opens upward near the bottom of the screen. */
export function ActionMenu({ label, text, actions }: { label: string; text?: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false); const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const toggle = () => {
    const r = root.current?.getBoundingClientRect();
    if (r) setUp(window.innerHeight - r.bottom < 56 * actions.length + 96);   // room for the items and the bottom nav
    setOpen(!open);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  if (!actions.length) return null;
  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      {text
        ? <Button size="sm" variant="secondary" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={toggle}>{text}<ChevronDown size={15} aria-hidden className={clsx('transition-transform', open && 'rotate-180')} /></Button>
        : <Button size="sm" variant="ghost" className="h-10 w-10 px-0" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={toggle}><MoreVertical size={18} aria-hidden /></Button>}
      {open && (
        <div role="menu" aria-label={label} className={clsx('ft-menu', text ? 'left-0' : 'right-0', up ? 'bottom-full mb-1.5' : 'mt-1.5')}>
          {actions.map(({ label: l, icon: Icon, danger, disabled, onSelect }) => (
            <button key={l} type="button" role="menuitem" disabled={disabled} onClick={() => { setOpen(false); onSelect(); }} className={clsx('ft-menu-item disabled:cursor-not-allowed disabled:opacity-50', danger && 'text-danger hover:bg-danger/10')}>
              {Icon && <Icon size={16} aria-hidden className="shrink-0" />}{l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const RefreshButton = ({ busy, onClick, label = 'Refresh' }: { busy: boolean; onClick: () => void; label?: string }) => (
  <Button size="sm" variant="secondary" disabled={busy} onClick={onClick}><RefreshCw size={14} aria-hidden className={clsx(busy && 'animate-spin')} /> {label}</Button>
);

/** A row of filters and a refresh above a list. Wraps on phones. */
export const Toolbar = ({ children }: { children: ReactNode }) => <div className="ft-inset flex flex-wrap items-end gap-2">{children}</div>;

/** Copy a secret and say whether it worked: clipboard access can be refused. */
export const copyText = (text: string) => { if (!navigator.clipboard) return Promise.reject(new Error('no clipboard')); return navigator.clipboard.writeText(text); };
