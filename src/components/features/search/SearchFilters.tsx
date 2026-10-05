import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';
import { Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { normalizeCode } from '@/lib/languages';
import type { SearchScope } from '@/services';
import { displayLabel, useDisplayLocales, useLanguages, useLanguageStore } from '@/store/languageStore';

export interface SearchFiltersValue { language: string; role: string; level: string; scope: SearchScope }

/** Compact filters: button + count, chips inline, selects in popover. Language names read in your language; common first, rest behind More. */
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
  if (value.scope === 'following') chips.push({ k: 'scope', label: 'Following' });
  const n = chips.length;
  const clear = () => onChange({ language: '', role: '', level: '', scope: 'everyone' });
  const drop = (k: keyof SearchFiltersValue) => onChange(k === 'scope' ? { scope: 'everyone' } : { [k]: '' } as Partial<SearchFiltersValue>);
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
  return (
    <div ref={ref} className="relative min-w-0 shrink-0">
      <div className="flex items-center gap-1.5">
        {chips.length > 0 && (
          <div className="flex min-w-0 max-w-[38vw] items-center gap-1 overflow-x-auto sm:max-w-none" aria-live="polite">
            {chips.map((c) => (
              <span key={c.k} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-soft py-0.5 pl-2 pr-1 text-xs font-semibold text-brand">
                {c.label}
                <button type="button" aria-label={`Remove ${c.label}`} onClick={() => drop(c.k)} className="rounded-full p-0.5 hover:bg-brand/20"><X size={11} aria-hidden /></button>
              </span>))}
          </div>)}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={n ? `Filters, ${n} active` : 'Filters'}
          className={clsx('inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-sm font-semibold transition', n || open ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-muted hover:text-ink') }>
          <SlidersHorizontal size={14} aria-hidden />
          {n > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-2xs font-bold text-on-brand">{n}</span>}
        </button>
        {n > 0 && <button type="button" onClick={clear} className="shrink-0 text-xs font-semibold text-muted hover:text-danger hover:underline">Clear</button>}
      </div>
      {open && (
        <div role="dialog" aria-label="Search filters" className="ft-card absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] p-3 shadow-pop">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1"><span className="text-2xs font-bold uppercase tracking-wide text-muted">Language</span>
              <Select aria-label="Language" value={value.language} onChange={txt('language')}><option value="">Any</option>{langOpts.map((l) => <option key={l.id} value={l.id}>{displayLabel(l, locales)}</option>)}{!showAll && restCount > 0 && <option value="__more__">More languages ({restCount})...</option>}</Select></label>
            <label className="flex flex-col gap-1"><span className="text-2xs font-bold uppercase tracking-wide text-muted">Speakers</span>
              <Select aria-label="Role" value={value.role} onChange={txt('role')}><option value="">Anyone</option><option value="native">Native</option><option value="learning">Learners</option></Select></label>
            <label className="flex flex-col gap-1"><span className="text-2xs font-bold uppercase tracking-wide text-muted">Level</span>
              <Select aria-label="Level" value={value.level} onChange={txt('level')}><option value="">Any</option>{LEARNER_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></label>
            <label className="flex flex-col gap-1"><span className="text-2xs font-bold uppercase tracking-wide text-muted">Who</span>
              <Select aria-label="Who" value={value.scope} onChange={(e) => onChange({ scope: e.target.value as SearchScope })}><option value="everyone">Everyone</option><option value="following">Following</option></Select></label>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs text-muted">{n ? `${n} active` : 'No filters'}{restCount > 0 && (showAll ? ` - all ${languages.length}` : ` - top ${common.length}`)}</span>
            <div className="flex gap-1.5">
              {restCount > 0 && <button type="button" onClick={() => setShowAll((v) => !v)} className="rounded-full px-2.5 py-1 text-sm font-semibold text-brand hover:bg-brand-soft">{showAll ? 'Less' : `More (${restCount})`}</button>}
              {n > 0 && <button type="button" onClick={clear} className="rounded-full px-2.5 py-1 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-danger">Clear</button>}
              <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded-full bg-brand px-3.5 py-1 text-sm font-semibold text-on-brand hover:opacity-90"><Check size={13} aria-hidden />Done</button>
            </div>
          </div>
        </div>)}
    </div>
  );
}
