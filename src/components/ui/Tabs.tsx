import clsx from 'clsx';
export const tabClass = (active: boolean) => clsx('rounded-full px-4 py-2 text-sm font-semibold', active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2');
/** Pill tabs. Controlled: the parent owns the selected key. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (key: T) => void; items: { key: T; label: string }[] }) {
  return (<div role="tablist" className="flex flex-wrap gap-2">{items.map((i) => <button key={i.key} role="tab" aria-selected={i.key === value} onClick={() => onChange(i.key)} className={tabClass(i.key === value)}>{i.label}</button>)}</div>);
}
