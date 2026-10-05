import clsx from 'clsx';
import { X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { normalizeCode } from '@/lib/languages';
import { useLanguages } from '@/store/languageStore';
import type { UserLanguage } from '@/types/db';

/**
 * Two jobs: tap the languages you speak natively; add languages you're learning with a CEFR
 * level. Options come from the store, which only ever holds `is_supported_learning` rows, and
 * every option is labelled with its native name. Only the ISO 639-3 id is ever put into
 * `value` -- the label is display only and never travels back to the caller or the database.
 */
export function LanguagePicker({ value, onChange }: { value: UserLanguage[]; onChange: (v: UserLanguage[]) => void }) {
  const list = useLanguages();
  const isNative = (id: string) => value.some((l) => l.role === 'native' && l.language_id === id);
  const toggleNative = (id: string) => onChange(isNative(id) ? value.filter((l) => !(l.role === 'native' && l.language_id === id)) : [...value, { language_id: id, role: 'native', level: 'Native' }]);
  const addLearning = () => { const free = list.find((l) => !value.some((v) => v.role === 'learning' && v.language_id === l.id)); if (free) onChange([...value, { language_id: free.id, role: 'learning', level: 'A1' }]); };
  const patch = (i: number, p: Partial<UserLanguage>) => onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-sm font-medium text-muted">I speak natively</p>
        <div className="flex flex-wrap gap-2">{list.map((l) => (
          <button type="button" key={l.id} aria-pressed={isNative(l.id)} onClick={() => toggleNative(l.id)}
            className={clsx('rounded-full px-3 py-1 text-sm font-medium transition', isNative(l.id) ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted hover:text-ink')}>{l.label}</button>))}</div></div>
      <div><p className="mb-2 text-sm font-medium text-muted">I'm learning</p>
        <div className="space-y-2">{value.map((l, i) => l.role !== 'learning' ? null : (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1"><Select aria-label="Language" value={l.language_id} onChange={(e) => patch(i, { language_id: normalizeCode(e.target.value) ?? l.language_id })}>{list.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></div>
            <div className="w-24"><Select aria-label="Level" value={l.level} onChange={(e) => patch(i, { level: e.target.value as UserLanguage['level'] })}>{LEARNER_LEVELS.map((lv) => <option key={lv}>{lv}</option>)}</Select></div>
            <Button type="button" variant="ghost" size="sm" aria-label="Remove language" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><X size={18} /></Button>
          </div>))}</div>
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addLearning}>Add a language</Button></div>
    </div>
  );
}
