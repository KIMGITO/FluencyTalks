import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';
import { LEARNER_LEVELS } from '@/lib/constants';
import { normalizeCode } from '@/lib/languages';
import { displayLabel, useDisplayLocales, useLanguages, useLanguageStore } from '@/store/languageStore';

export interface SearchFiltersValue { language: string; role: string; level: string }


export function SearchFilters({ value, onChange }: { value: SearchFiltersValue; onChange: (p: Partial<SearchFiltersValue>) => void }) {
  const languages = useLanguages();
  const nameIn = useLanguageStore((s) => s.nameIn);
  const locales = useDisplayLocales();
  const common = useMemo(() => languages.filter((l) => l.is_supported_learning), [languages]);
  const restCount = languages.length - common.length;
  const [showAll, setShowAll] = useState(false);
  const langOpts = showAll || !common.length ? languages : common;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const chips: { k: keyof SearchFiltersValue; label: string }[] = [];
  if (value.language) chips.push({ k: 'language', label: nameIn(value.language, locales) });
  if (value.role) chips.push({ k: 'role', label: value.role === 'native' ? 'Native' : 'Learners' });
  if (value.level) chips.push({ k: 'level', label: value.level });

  const n = chips.length;
  const clear = () => onChange({ language: '', role: '', level: '' });
  useEffect(() => {
    if (!open) return;
    const doc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', doc);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', doc); document.removeEventListener('keydown', key); };
  }, [open]);
  const txt = (k: 'language' | 'role' | 'level') => (e: ChangeEvent<HTMLSelectElement>) => {
    if (k === 'language' && e.target.value === '__more__') { setShowAll(true); return; }
    onChange({ [k]: k === 'language' ? (normalizeCode(e.target.value) ?? '') : e.target.value });
  };
  // One compact row per filter: label on the left, a small select on the right.
  const row = (label: string, k: 'language' | 'role' | 'level', options: ReactNode) => (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select
        aria-label={label}
        value={value[k]}
        onChange={txt(k)}
        className={clsx('h-8 min-w-0 max-w-[9.5rem] flex-1 truncate rounded-sm border bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30',
          value[k] ? 'border-brand' : 'border-border')}
      >
        {options}
      </select>
    </label>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        aria-label={n ? `Filters, ${n} active: ${chips.map((c) => c.label).join(', ')}` : 'Filters'}
        title={n ? chips.map((c) => c.label).join(' · ') : 'Filters'}
        className={clsx('relative inline-flex h-8 w-8 items-center justify-center rounded-sm border transition', n || open ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-muted hover:text-ink')}>
        <SlidersHorizontal size={15} aria-hidden />
        {n > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-on-deep">{n}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Search filters" className="ft-menu right-0 mt-1.5 w-[min(15rem,calc(100vw-1.5rem))] px-3 py-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-ink">Filters</span>
            {n > 0
              ? <button type="button" onClick={clear} className="text-xs font-semibold text-muted hover:text-danger">Clear all</button>
              : <button type="button" aria-label="Close filters" onClick={() => setOpen(false)} className="rounded-full p-0.5 text-muted hover:text-ink"><X size={14} aria-hidden /></button>}
          </div>
          {row('Language', 'language', <>
            <option value="">Any</option>
            {langOpts.map((l) => <option key={l.id} value={l.id}>{displayLabel(l, locales)}</option>)}
            {!showAll && restCount > 0 && <option value="__more__">More languages ({restCount})…</option>}
          </>)}
          {row('Speakers', 'role', <><option value="">Anyone</option><option value="native">Native</option><option value="learning">Learners</option></>)}
          {row('Level', 'level', <><option value="">Any</option>{LEARNER_LEVELS.map((l) => <option key={l}>{l}</option>)}</>)}
        </div>)}
    </div>
  );
}
