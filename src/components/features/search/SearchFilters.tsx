import type { ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { normalizeCode } from '@/lib/languages';
import type { SearchScope } from '@/services';
import { useLanguages } from '@/store/languageStore';

export interface SearchFiltersValue { language: string; role: string; level: string; scope: SearchScope }

/** Narrowing filters for the people half of the search. Every control is optional and they combine. */
export function SearchFilters({ value, onChange }: { value: SearchFiltersValue; onChange: (patch: Partial<SearchFiltersValue>) => void }) {
  const languages = useLanguages();          // only is_supported_learning rows, native names
  const active = !!value.language || !!value.role || !!value.level || value.scope === 'following';
  // The URL can be hand-edited, so a filter value is only accepted if it is still a real id.
  const text = (key: 'language' | 'role' | 'level') => (e: ChangeEvent<HTMLSelectElement>) =>
    onChange({ [key]: key === 'language' ? (normalizeCode(e.target.value) ?? '') : e.target.value });
  return (
    // Controls wrap as a flex row — each grows to share the line instead of forcing a column.
    <div className="ft-card ft-card-pad mb-3 flex flex-wrap items-center gap-1.5">
      <div className="min-w-[9rem] flex-[2_1_9rem]">
        <Select aria-label="Language" value={value.language} onChange={text('language')}>
          <option value="">Any language</option>{languages.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
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