import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { normalizeCode } from '@/lib/languages';
import { displayLabel, useDisplayLocales, useLanguages } from '@/store/languageStore';
import type { DisplayLanguage, UserLanguage } from '@/types/db';

const PAGE = 6;

/**
 * Paged A-Z picker: 20 rows per page, alphabetical by the name YOU read.
 * Page shows only its 20; More hides them and shows the next 20 until none left.
 * Previous walks back. Common 100 first (A-Z), then the rest (A-Z) — one list.
 */
function usePaged(list: DisplayLanguage[], locales: string[]) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const ordered = useMemo(() => {
    const withKey = list.map((l) => ({ l, key: displayLabel(l, locales) }));
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtered = q ? withKey.filter(({ l, key }) => norm(key).includes(norm(q)) || norm(l.english_name).includes(norm(q))) : withKey;
    const common = filtered.filter(({ l }) => l.is_supported_learning).sort((a, b) => a.key.localeCompare(b.key));
    const rest = filtered.filter(({ l }) => !l.is_supported_learning).sort((a, b) => a.key.localeCompare(b.key));
    return [...common, ...rest].map(({ l }) => l);
  }, [list, locales, q]);
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE));
  const safe = Math.min(page, pages - 1);
  // One page at a time: More hides the current 20 and shows the next 20; Previous walks back.
  const rows = ordered.slice(safe * PAGE, safe * PAGE + PAGE);
  return { q, setQ: (v: string) => { setQ(v); setPage(0); }, page: safe, pages, rows, total: ordered.length, next: () => setPage((p) => Math.min(p + 1, pages - 1)), prev: () => setPage((p) => Math.max(p - 1, 0)) };
}

function Pager({ page, pages, total, onPrev, onMore }: { page: number; pages: number; total: number; onPrev: () => void; onMore: () => void }) {
  const last = page >= pages - 1;
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-xs text-muted" aria-live="polite">Page {page + 1} of {pages} · {total} languages</span>
      <div className="flex gap-1.5">
        {page > 0 && (
          <button type="button" onClick={onPrev} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm font-semibold text-muted hover:text-ink"><ChevronLeft size={14} aria-hidden />Previous</button>)}
        {!last && (
          <button type="button" onClick={onMore} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm font-semibold text-brand hover:bg-brand-soft">More<ChevronRight size={14} aria-hidden /></button>)}
      </div>
    </div>
  );
}

function SearchRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mb-2">
      <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search languages..." aria-label="Search languages" autoComplete="off"
        className="w-full rounded-full border border-border bg-surface-2 py-1.5 pl-9 pr-8 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none" />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-ink"><X size={14} aria-hidden /></button>}
    </div>
  );
}

/**
 * Two jobs: tap the languages you speak natively; add languages you're learning with a CEFR
 * level. Names read in YOUR native language first. Each section is A-Z, 20 per page —
 * the page swaps (never grows) via More / Previous until no more remain.
 */
export function LanguagePicker({ value, onChange }: { value: UserLanguage[]; onChange: (v: UserLanguage[]) => void }) {
  const list = useLanguages();
  const locales = useDisplayLocales();
  const native = usePaged(list, locales);
  const [learnSearch, setLearnSearch] = useState('');
  const [learnPage, setLearnPage] = useState(0);
  const [learnOpen, setLearnOpen] = useState(false);
  const isNative = (id: string) => value.some((l) => l.role === 'native' && l.language_id === id);
  const toggleNative = (id: string) => onChange(isNative(id) ? value.filter((l) => !(l.role === 'native' && l.language_id === id)) : [...value, { language_id: id, role: 'native', level: 'Native' }]);
  const label = (id: string) => { const row = list.find((l) => l.id === id); return row ? displayLabel(row, locales) : id; };
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const learnPool = useMemo(() => {
    const withKey = list.map((l) => ({ l, key: displayLabel(l, locales) }));
    const f = learnSearch ? withKey.filter(({ l, key }) => norm(key).includes(norm(learnSearch)) || norm(l.english_name).includes(norm(learnSearch))) : withKey;
    const c = f.filter(({ l }) => l.is_supported_learning).sort((a, b) => a.key.localeCompare(b.key));
    const r = f.filter(({ l }) => !l.is_supported_learning).sort((a, b) => a.key.localeCompare(b.key));
    return [...c, ...r].map(({ l }) => l);
  }, [list, locales, learnSearch]);
  const learnPages = Math.max(1, Math.ceil(learnPool.length / PAGE));
  const learnRows = learnPool.slice(learnPage * PAGE, learnPage * PAGE + PAGE);
  const addLearning = (id?: string) => {
    const pick = (id && learnPool.find((l) => l.id === id)) ?? learnPool.find((l) => !value.some((v) => v.role === 'learning' && v.language_id === l.id));
    if (pick) onChange([...value, { language_id: pick.id, role: 'learning', level: 'A1' }]);
  };
  const patch = (i: number, p: Partial<UserLanguage>) => onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-6">
      <section aria-label="I speak natively">
        <p className="mb-2 text-sm font-medium text-muted">I speak natively</p>
        {native.total > PAGE || native.q ? <SearchRow value={native.q} onChange={native.setQ} /> : null}
        <div className="ft-card divide-y divide-border" role="listbox" aria-label="Native languages">
          {native.rows.map((l) => {
            const on = isNative(l.id);
            return (
              <button type="button" key={l.id} role="option" aria-selected={on} onClick={() => toggleNative(l.id)} title={l.english_name}
                className={clsx('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-surface-2', on && 'bg-brand-soft/60')}>
                <span className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold', on ? 'border-brand bg-brand text-on-brand' : 'border-border text-transparent')}>✓</span>
                <span className="min-w-0 flex-1 truncate font-medium">{displayLabel(l, locales)}</span>
                {l.native_name && l.native_name.toLowerCase() !== displayLabel(l, locales).toLowerCase() && <span className="hidden shrink-0 truncate text-xs text-muted sm:block">{l.english_name}</span>}
              </button>);
          })}
          {!native.rows.length && <p className="px-3 py-4 text-center text-sm text-muted">No languages match “{native.q}”.</p>}
        </div>
        <Pager page={native.page} pages={native.pages} total={native.total} onPrev={native.prev} onMore={native.next} />
        {native.pages > 1 && <p className="mt-1 text-xs text-muted">Showing 20 A–Z — More hides these and shows the next 20.</p>}
      </section>
      <section aria-label="I'm learning">
        <p className="mb-2 text-sm font-medium text-muted">I’m learning</p>
        <div className="space-y-2">{value.map((l, i) => l.role !== 'learning' ? null : (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1"><Select aria-label="Language" value={l.language_id} onChange={(e) => patch(i, { language_id: normalizeCode(e.target.value) ?? l.language_id })}>
              <option value={l.language_id}>{label(l.language_id)}</option>
              {list.filter((x) => x.id !== l.language_id).map((x) => <option key={x.id} value={x.id}>{displayLabel(x, locales)}</option>)}
            </Select></div>
            <div className="w-24"><Select aria-label="Level" value={l.level} onChange={(e) => patch(i, { level: e.target.value as UserLanguage['level'] })}>{LEARNER_LEVELS.map((lv) => <option key={lv}>{lv}</option>)}</Select></div>
            <Button type="button" variant="ghost" size="sm" aria-label="Remove language" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><X size={18} /></Button>
          </div>))}</div>
        <div className="mt-2">
          <button type="button" onClick={() => { setLearnOpen((v) => !v); setLearnPage(0); }} aria-expanded={learnOpen}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Add a language<ChevronDown size={14} className={clsx('transition', learnOpen && 'rotate-180')} /></button>
          {learnOpen && (
            <div className="mt-2">
              <SearchRow value={learnSearch} onChange={(v) => { setLearnSearch(v); setLearnPage(0); }} />
              <div className="ft-card divide-y divide-border">
                {learnRows.map((l) => (
                  <button type="button" key={l.id} onClick={() => { addLearning(l.id); }} title={l.english_name}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-surface-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{displayLabel(l, locales)}</span>
                    <span className="shrink-0 text-xs font-semibold text-brand">Add</span>
                  </button>))}
                {!learnRows.length && <p className="px-3 py-4 text-center text-sm text-muted">No languages match.</p>}
              </div>
              <Pager page={learnPage} pages={learnPages} total={learnPool.length} onPrev={() => setLearnPage((p) => Math.max(p - 1, 0))} onMore={() => setLearnPage((p) => Math.min(p + 1, learnPages - 1))} />
            </div>)}
        </div>
      </section>
    </div>
  );
}
