import { useMemo } from 'react';
import { Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { displayLabel, useDisplayLocales, useLanguages } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import type { DisplayLanguage } from '@/types/db';

export type LearnerLevel = (typeof LEARNER_LEVELS)[number];

export interface LanguageChoice { native: string; learning: string; level: LearnerLevel }

const COOLDOWN_DAYS = 30;


export function languageLockedUntil(lastChange: string | null | undefined): Date | null {
  if (!lastChange) return null;
  const until = new Date(new Date(lastChange).getTime() + COOLDOWN_DAYS * 86_400_000);
  return until.getTime() > Date.now() ? until : null;
}


export function LanguageSelect({ value, onChange }: { value: LanguageChoice; onChange: (v: LanguageChoice) => void }) {
  const list = useLanguages();
  const locales = useDisplayLocales();
  const lastChange = useProfileStore((s) => s.me?.last_language_change_at);
  const lockedUntil = languageLockedUntil(lastChange);

  const options = useMemo(() => {
    const keep = (l: DisplayLanguage, current: string) => l.is_supported_learning || l.id === current;
    const sorted = (rows: DisplayLanguage[]) =>
      rows.map((l) => ({ l, label: displayLabel(l, locales) })).sort((a, b) => a.label.localeCompare(b.label));
    return {
      native: sorted(list.filter((l) => keep(l, value.native) && l.id !== value.learning)),
      learning: sorted(list.filter((l) => keep(l, value.learning) && l.id !== value.native)),
    };
  }, [list, locales, value.native, value.learning]);

  return (
    <div className="space-y-4">
      <Select
        label="I speak natively"
        searchable
        value={value.native}
        disabled={!!lockedUntil}
        onChange={(e) => onChange({ ...value, native: e.target.value })}
      >
        <option value="" disabled>Choose your native language</option>
        {options.native.map(({ l, label }) => <option key={l.id} value={l.id}>{label}</option>)}
      </Select>

      <div className="grid grid-cols-[1fr_7rem] items-end gap-3">
        <Select
          label="I'm learning (optional)"
          searchable
          value={value.learning}
          disabled={!!lockedUntil}
          onChange={(e) => onChange({ ...value, learning: e.target.value })}
        >
          <option value="">Not learning a language right now</option>
          {options.learning.map(({ l, label }) => <option key={l.id} value={l.id}>{label}</option>)}
        </Select>
        {value.learning && (
          <Select label="Level" value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as LearnerLevel })}>
            {LEARNER_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
          </Select>
        )}
      </div>

      <p className="text-xs text-muted">
        {lockedUntil
          ? `You changed languages recently. You can change them again on ${lockedUntil.toLocaleDateString()}. Your level can be updated any time.`
          : 'Pick one native language and at most one language to learn. After your first change, languages can be changed once every 30 days.'}
      </p>
    </div>
  );
}
