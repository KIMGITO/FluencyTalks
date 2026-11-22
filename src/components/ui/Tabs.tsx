import clsx from 'clsx';
/**
 * Underlined tabs, like the contents tabs on the public pages: the open tab gets a coral rule. Put them in `tabsClass`.
 * Always one row: when they don't fit the screen they scroll sideways instead of wrapping. The grey rule is an inset
 * shadow rather than a border, so the scroll box has nothing hanging below it to scroll vertically.
 */
export const tabsClass = 'flex min-w-0 max-w-full flex-nowrap gap-x-5 overflow-x-auto overflow-y-hidden overscroll-x-contain shadow-[inset_0_-1px_0_rgb(var(--c-border))]';
export const tabClass = (active: boolean) => clsx('min-h-[2.75rem] shrink-0 whitespace-nowrap border-b-[3px] px-0.5 py-2.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60', active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink');

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (key: T) => void; items: { key: T; label: string }[] }) {
  return (<div role="tablist" className={tabsClass}>{items.map((i) => <button key={i.key} role="tab" aria-selected={i.key === value} onClick={() => onChange(i.key)} className={tabClass(i.key === value)}>{i.label}</button>)}</div>);
}
