import type { ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import type { SearchScope } from '@/services';
import { useLanguageStore } from '@/store/languageStore';

export interface SearchFiltersValue { language: string; role: string; level: string; scope: SearchScope }

/** Narrowing filters for the people half of the search. Every control is optional and they combine. */
export function SearchFilters({ value, onChange }: { value: SearchFiltersValue; onChange: (patch: Partial<SearchFiltersValue>) => void }) {
  const languages = useLanguageStore((s) => s.list);
  const active = !!value.language || !!value.role || !!value.level || value.scope === 'following';
  const text = (key: 'language' | 'role' | 'level') => (e: ChangeEvent<HTMLSelectElement>) => onChange({ [key]: e.target.value });
  return (
    // Controls wrap as a flex row — each grows to share the line instead of forcing a column.
    <div className="ft-card ft-card-pad mb-3 flex flex-wrap items-center gap-1.5">
      <div className="min-w-[9rem] flex-[2_1_9rem]">
        <Select aria-label="Language" value={value.language} onChange={text('language')}>
          <option value="">Any language</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </Select>
      </div>
      <div className="min-w-[9rem] flex-1">
        <Select aria-label="Role" value={value.role} onChange={text('role')}>
          <option value="">Native or learning</option><option value="native">Native speakers</option><option value="learning">Learners</option>
        </Select>
      </div>
      <div className="min-w-[6rem] flex-1">
        <Select aria-label="Level" value={value.level} onChange={text('level')}>
          <option value="">Any level</option>{LEARNER_LEVELS.map((l) => <option key={l}>{l}</option>)}
        </Select>
      </div>
      <div className="min-w-[9rem] flex-1">
        <Select aria-label="Who" value={value.scope} onChange={(e) => onChange({ scope: e.target.value as SearchScope })}>
          <option value="everyone">Everyone</option><option value="following">People you follow</option>
        </Select>
      </div>
      {active && (
        <Button size="sm" variant="ghost" aria-label="Clear filters" className="ml-auto"
          onClick={() => onChange({ language: '', role: '', level: '', scope: 'everyone' })}>
          <X size={14} aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}