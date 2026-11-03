import clsx from 'clsx';
import { Check, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface PickerOption { id: string; name: string; autonym: string | null; english?: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Full list in a sheet: bottom sheet on phones, centred dialog from `sm`. Search matches the shown name, the name in English or in the language itself, and the code. */
export function LanguagePicker({ title, value, options, clearLabel, onPick, onClose }: {
  title: string;
  value: string;
  options: PickerOption[];
  /** Adds a first row that picks '' (e.g. "Not learning a language right now"). */
  clearLabel?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);   // read before the search box takes focus

  const rows = useMemo(() => {
    const n = norm(q.trim());
    const hits = n ? options.filter((o) => norm(`${o.name} ${o.autonym ?? ''} ${o.english ?? ''} ${o.id}`).includes(n)) : options;
    return !n && clearLabel ? [{ id: '', name: clearLabel, autonym: null }, ...hits] : hits;
  }, [options, q, clearLabel]);
  const activeIdx = Math.min(active, rows.length - 1);

  // Start on the current choice.
  useEffect(() => { setActive(Math.max(0, rows.findIndex((r) => r.id === value))); }, []);
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [activeIdx]);
  // The page behind stays put while the sheet is open, and focus goes back where it came from.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; opener.current?.focus(); };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((activeIdx + 1) % Math.max(rows.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((activeIdx - 1 + rows.length) % Math.max(rows.length, 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[activeIdx]) onPick(rows[activeIdx].id); }
    else if (e.key === 'Tab') e.preventDefault();   // the search box keeps focus: arrows move through the list
  };

  return createPortal(
    <div className="ft-overlay fixed inset-0 z-50 flex items-end justify-center bg-deep/60 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-xl bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-pop sm:h-[34rem] sm:max-w-md sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-accent/40">
            <Search size={16} aria-hidden className="shrink-0 text-muted" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="language-picker-list"
              aria-autocomplete="list"
              aria-activedescendant={rows.length ? `language-picker-${activeIdx}` : undefined}
              aria-label={`Search: ${title}`}
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder="Search languages"
              className="h-11 w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <ul id="language-picker-list" ref={listRef} role="listbox" aria-label={title} className="min-h-[12rem] flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {rows.length === 0 && <li role="presentation" className="px-3 py-8 text-center text-sm text-muted">No language matches “{q.trim()}”.</li>}
          {rows.map((o, i) => {
            const selected = o.id === value;
            return (
              <li
                key={o.id || 'none'}
                id={`language-picker-${i}`}
                role="option"
                aria-selected={selected}
                data-active={i === activeIdx ? 'true' : undefined}
                onMouseMove={() => setActive(i)}
                onClick={() => onPick(o.id)}
                className={clsx('flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2', i === activeIdx && 'bg-surface-2')}
              >
                <LanguageMark id={o.id} active={selected} />
                <span className="min-w-0 flex-1">
                  <span className={clsx('block truncate text-sm text-ink sm:text-base', selected ? 'font-bold' : 'font-medium')}>{o.name}</span>
                  {o.autonym && <span className="block truncate text-xs text-muted">{o.autonym}</span>}
                </span>
                {selected && <Check size={18} aria-hidden className="shrink-0 text-accent" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

/** The language code in a tile. Codes, not flags: a language is not a country. */
export function LanguageMark({ id, active }: { id: string; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold uppercase',
        active ? 'bg-brand text-on-brand' : 'bg-brand-soft text-brand',
      )}
    >
      {id || '—'}
    </span>
  );
}
