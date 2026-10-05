import clsx from 'clsx';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  Children, isValidElement, useEffect, useId, useMemo, useRef, useState,
  type ChangeEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes,
} from 'react';

type Opt = { value: string; label: string; disabled: boolean };

/* Same drop-in props as the native control, plus optional search. */
type Props = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; searchable?: boolean };

/* Accent/case-insensitive matching so "Portugues" finds "Português". */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* Reads <option>/<optgroup> children; value falls back to the label like the native control. */
const parseOptions = (children: ReactNode): Opt[] => {
  const out: Opt[] = [];
  const walk = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const p = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean };
      if (child.type === 'option') {
        const text = typeof p.children === 'string' || typeof p.children === 'number' ? String(p.children) : '';
        out.push({
          value: p.value == null ? text : String(p.value),
          label: text || String(p.value ?? ''),
          disabled: !!p.disabled,
        });
        return;
      }
      walk(p.children); // <optgroup>, fragments, wrappers
    });
  };
  walk(children);
  return out;
};

export function Select({
  label,
  className,
  children,
  searchable,
  value,
  onChange,
  disabled,
  name,
  required,
  id,
  'aria-label': ariaLabel,
  ...rest
}: Props) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const labelId = `${triggerId}-label`;
  const listboxId = `${triggerId}-listbox`;
  const valueId = `${triggerId}-value`;

  const all = useMemo(() => parseOptions(children), [children]);
  /* Search only pays off on long lists; pass `searchable` to force it either way. */
  const showSearch = searchable ?? all.length > 7;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [flip, setFlip] = useState(false);
  const [internal, setInternal] = useState(value);

  const current = value !== undefined ? String(value) : internal !== undefined ? String(internal) : all[0]?.value ?? '';
  const selectedLabel = all.find((o) => o.value === current)?.label ?? current;

  const filtered = useMemo(() => {
    if (!q) return all;
    const n = norm(q);
    return all.filter((o) => norm(o.label).includes(n) || norm(o.value).includes(n));
  }, [all, q]);
  const activeIdx = filtered.length ? Math.min(active, filtered.length - 1) : -1;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  /* Focus the search box (or the active option) and keep it scrolled into view. */
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (showSearch) inputRef.current?.focus();
    else el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, showSearch, activeIdx, q]);

  /* Open upward when the space below the trigger is too tight. */
  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setFlip(below < Math.min(340, window.innerHeight * 0.6) && r.top > below);
  }, [open]);

  useEffect(() => {
    if (disabled && open) { setOpen(false); setQ(''); }
  }, [disabled, open]);

  const close = (restoreFocus?: boolean) => {
    setOpen(false);
    setQ('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  const openList = (start?: 'first' | 'last') => {
    const sel = filtered.findIndex((o) => o.value === current);
    typed.current = { text: '', at: 0 };
    setQ('');
    setActive(start === 'first' ? 0 : start === 'last' ? filtered.length - 1 : sel >= 0 ? sel : 0);
    setOpen(true);
  };
  const choose = (v: string) => {
    close(true);
    if (v === current) return;
    setInternal(v);
    /* Call sites only read `target.value` — mirror it so onChange(e.target.value) works. */
    onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>);
  };

  const move = (dir: number) =>
    setActive((prev) => {
      const len = filtered.length;
      if (!len) return 0;
      let i = Math.max(0, Math.min(prev, len - 1));
      for (let step = 0; step < len; step++) {
        i = (i + dir + len) % len;
        if (!filtered[i].disabled) return i;
      }
      return prev;
    });

  const jump = (edge: 'home' | 'end') => {
    const i = edge === 'home'
      ? filtered.findIndex((o) => !o.disabled)
      : filtered.map((o) => o.disabled).lastIndexOf(false);
    if (i >= 0) setActive(i);
  };

  const typeAhead = (ch: string) => {
    const now = Date.now();
    typed.current.text = now - typed.current.at < 800 ? typed.current.text + ch : ch;
    typed.current.at = now;
    const n = norm(typed.current.text);
    const i = filtered.findIndex((o) => !o.disabled && norm(o.label).startsWith(n));
    if (i >= 0) setActive(i);
  };

  const pickActive = () => {
    const o = activeIdx >= 0 ? filtered[activeIdx] : undefined;
    if (o && !o.disabled) choose(o.value);
  };

  const onQuery = (v: string) => { setQ(v); setActive(0); }; // first match becomes active while typing

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) close(true);
      else openList(e.key === 'ArrowUp' ? 'last' : 'first');
      return;
    }
    if (e.key === 'Escape' && open) { e.preventDefault(); close(true); return; }
    /* Native type-ahead: start typing on the closed control. */
    if (!open && e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      openList('first');
      if (showSearch) onQuery(e.key);
      else typeAhead(e.key);
    }
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // don't let the surrounding modal close too
        close(true);
        break;
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': if (!showSearch) { e.preventDefault(); jump('home'); } break;
      case 'End': if (!showSearch) { e.preventDefault(); jump('end'); } break;
      case 'Enter':
        e.preventDefault(); // never submit the surrounding form from the search box
        pickActive();
        break;
      case ' ':
        if (!showSearch) { e.preventDefault(); pickActive(); } // in the search box a space is text
        break;
      default:
        if (!showSearch && e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) typeAhead(e.key);
    }
  };
  return (
    <div className="block">
      {label && (
        <label id={labelId} htmlFor={triggerId} className="mb-1 block text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) close(); // Tab away closes like the native control
        }}
      >
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-required={required || undefined}
          onClick={() => (open ? close(true) : openList())}
          onKeyDown={onTriggerKeyDown}
          className={clsx(
            'flex min-h-11 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2.5 text-left text-sm text-ink transition duration-200 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 sm:py-3 sm:text-base',
            disabled
              ? 'cursor-not-allowed opacity-60'
              : clsx('hover:border-brand/50', open && 'border-brand ring-2 ring-brand/30'),
            className,
          )}
        >
          <span id={valueId} className="truncate">{selectedLabel}</span>
          <ChevronDown
            size={18}
            aria-hidden
            className={clsx('shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
          />
        </button>

        {open && (
          <>
            {/* Click-away layer, under the menu (the menu itself is inert). */}
            <div className="fixed inset-0 z-30" onMouseDown={() => close()} />
            <div
              onKeyDown={onPanelKeyDown}
              className={clsx(
                'ft-card absolute inset-x-0 z-40 overflow-hidden shadow-pop',
                flip ? 'bottom-full mb-1' : 'top-full mt-1',
              )}
            >
              {showSearch && (
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Search size={16} aria-hidden className="shrink-0 text-muted" />
                  <input
                    ref={inputRef}
                    role="combobox"
                    aria-expanded
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeIdx >= 0 ? `${listboxId}-${activeIdx}` : undefined}
                    aria-label={label ? `Search ${label}` : 'Search options'}
                    value={q}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full min-w-0 bg-transparent py-1 text-base text-ink outline-none placeholder:text-muted"
                  />
                  {q && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onMouseDown={(e) => { e.preventDefault(); onQuery(''); }}
                      className="shrink-0 rounded-full p-0.5 text-muted hover:text-ink"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </div>
              )}
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label={label ?? ariaLabel}
                className="max-h-[min(16rem,60vh)] overflow-y-auto overscroll-contain py-1"
              >
                {filtered.length === 0 && (
                  <li role="presentation" className="px-3 py-3 text-sm text-muted">
                    No matches{q && ` for “${q}”`}
                  </li>
                )}
                {filtered.map((o, i) => {
                  const sel = o.value === current;
                  const act = i === activeIdx;
                  return (
                    <li
                      key={`${o.value}-${i}`}
                      id={`${listboxId}-${i}`}
                      role="option"
                      aria-selected={sel}
                      aria-disabled={o.disabled || undefined}
                      data-active={act ? 'true' : undefined}
                      tabIndex={-1}
                      onMouseMove={() => { if (!o.disabled) setActive(i); }}
                      onMouseDown={(e) => { e.preventDefault(); if (!o.disabled) choose(o.value); }}
                      className={clsx(
                        'flex cursor-default select-none items-center justify-between gap-2 px-3 py-2.5 text-sm sm:text-base',
                        o.disabled && 'cursor-not-allowed opacity-50',
                        act && !o.disabled && (sel ? 'bg-brand/10' : 'bg-surface-2'),
                        sel && 'font-semibold',
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {sel && <Check size={16} aria-hidden className="shrink-0 text-brand" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>
      {/* Kept in the DOM so name/required/form-association still work with the hidden native control. */}
      <select
        className="hidden"
        name={name}
        required={required}
        disabled={disabled}
        value={value !== undefined ? value : internal}
        onChange={onChange}
        tabIndex={-1}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

