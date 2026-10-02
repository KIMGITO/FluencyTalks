import clsx from 'clsx';
import { X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { useLanguageStore } from '@/store/languageStore';
import type { UserLanguage } from '@/types/db';

/** Two jobs: tap the languages you speak natively; add languages you're learning with a CEFR level. */
export function LanguagePicker({ value, onChange }: { value: UserLanguage[]; onChange: (v: UserLanguage[]) => void }) {
  const list = useLanguageStore((s) => s.list);
  const isNative = (code: string) => value.some((l) => l.role === 'native' && l.language_code === code);
  const toggleNative = (code: string) => onChange(isNative(code) ? value.filter((l) => !(l.role === 'native' && l.language_code === code)) : [...value, { language_code: code, role: 'native', level: 'Native' }]);
  const addLearning = () => { const free = list.find((l) => !value.some((v) => v.role === 'learning' && v.language_code === l.code)); if (free) onChange([...value, { language_code: free.code, role: 'learning', level: 'A1' }]); };
  const patch = (i: number, p: Partial<UserLanguage>) => onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-sm font-medium text-muted">I speak natively</p>
        <div className="flex flex-wrap gap-2">{list.map((l) => (
          <button type="button" key={l.code} aria-pressed={isNative(l.code)} onClick={() => toggleNative(l.code)}
            className={clsx('rounded-full px-3 py-1 text-sm font-medium transition', isNative(l.code) ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted hover:text-ink')}>{l.name}</button>))}</div></div>
      <div><p className="mb-2 text-sm font-medium text-muted">I'm learning</p>
        <div className="space-y-2">{value.map((l, i) => l.role !== 'learning' ? null : (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1"><Select aria-label="Language" value={l.language_code} onChange={(e) => patch(i, { language_code: e.target.value })}>{list.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</Select></div>
            <div className="w-24"><Select aria-label="Level" value={l.level} onChange={(e) => patch(i, { level: e.target.value as UserLanguage['level'] })}>{LEARNER_LEVELS.map((lv) => <option key={lv}>{lv}</option>)}</Select></div>
            <Button type="button" variant="ghost" size="sm" aria-label="Remove language" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><X size={18} /></Button>
          </div>))}</div>
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addLearning}>Add a language</Button></div>
    </div>
  );
}
