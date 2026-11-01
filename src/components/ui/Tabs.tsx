import clsx from 'clsx';
/** Underlined tabs, like the contents tabs on the public pages: the open tab gets a coral rule. Put them in `tabsClass`. */
export const tabsClass = 'flex flex-wrap gap-x-5 border-b border-border';
export const tabClass = (active: boolean) => clsx('-mb-px border-b-[3px] px-0.5 py-2.5 text-sm font-bold transition-colors', active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink');

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (key: T) => void; items: { key: T; label: string }[] }) {
  return (<div role="tablist" className={tabsClass}>{items.map((i) => <button key={i.key} role="tab" aria-selected={i.key === value} onClick={() => onChange(i.key)} className={tabClass(i.key === value)}>{i.label}</button>)}</div>);
}
