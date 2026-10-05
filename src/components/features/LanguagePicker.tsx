import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { LEARNER_LEVELS } from '@/lib/constants';
import { normalizeCode } from '@/lib/languages';
import {
  displayLabel,
  useDisplayLocales,
  useLanguages,
} from '@/store/languageStore';
import type { UserLanguage } from '@/types/db';

/**
 * Two jobs: tap the languages you speak natively; add languages you're learning with a CEFR
 * level. Names read in YOUR native language first (then English, then the autonym):
 * "Japanese (autonym in its script)". Common 100 show first; everything else seeded lives
 * behind "More languages..." so the list never overwhelms. Only the ISO 639-3 id is stored.
 */
export function LanguagePicker({
  value,
  onChange,
}: {
  value: UserLanguage[];
  onChange: (v: UserLanguage[]) => void;
}) {
  const list = useLanguages();
  const locales = useDisplayLocales();
  const [showAllNative, setShowAllNative] = useState(false);
  const [showAllLearning, setShowAllLearning] = useState(false);
  const label = (id: string) => {
    const row = list.find((l) => l.id === id);
    return row ? displayLabel(row, locales) : id;
  };
  const common = useMemo(
    () => list.filter((l) => l.is_supported_learning),
    [list],
  );
  const rest = useMemo(
    () => list.filter((l) => !l.is_supported_learning),
    [list],
  );
  const nativeOpts = showAllNative ? list : common.length ? common : list;
  const isNative = (id: string) =>
    value.some((l) => l.role === 'native' && l.language_id === id);
  const toggleNative = (id: string) =>
    onChange(
      isNative(id)
        ? value.filter((l) => !(l.role === 'native' && l.language_id === id))
        : [...value, { language_id: id, role: 'native', level: 'Native' }],
    );
  const learningOpts = (showAll: boolean) =>
    showAll ? list : common.length ? common : list;
  const addLearning = () => {
    const opts = learningOpts(showAllLearning);
    const free =
      opts.find(
        (l) =>
          !value.some((v) => v.role === 'learning' && v.language_id === l.id),
      ) ??
      list.find(
        (l) =>
          !value.some((v) => v.role === 'learning' && v.language_id === l.id),
      );
    if (free)
      onChange([
        ...value,
        { language_id: free.id, role: 'learning', level: 'A1' },
      ]);
  };
  const patch = (i: number, p: Partial<UserLanguage>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-muted">I speak natively</p>
        <div className="flex flex-wrap gap-2">
          {nativeOpts.map((l) => (
            <button
              type="button"
              key={l.id}
              aria-pressed={isNative(l.id)}
              onClick={() => toggleNative(l.id)}
              title={l.english_name}
              className={clsx(
                'rounded-full px-3 py-1 text-sm font-medium transition',
                isNative(l.id)
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface-2 text-muted hover:text-ink',
              )}
            >
              {displayLabel(l, locales)}
            </button>
          ))}
        </div>
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAllNative((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            More languages ({rest.length})
            <ChevronDown
              size={14}
              className={clsx('transition', showAllNative && 'rotate-180')}
            />
          </button>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted">I'm learning</p>
        <div className="space-y-2">
          {value.map((l, i) =>
            l.role !== 'learning' ? null : (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    aria-label="Language"
                    value={l.language_id}
                    onChange={(e) =>
                      patch(i, {
                        language_id:
                          normalizeCode(e.target.value) ?? l.language_id,
                      })
                    }
                  >
                    {learningOpts(showAllLearning).map((x) => (
                      <option key={x.id} value={x.id}>
                        {displayLabel(x, locales)}
                      </option>
                    ))}
                    {!learningOpts(showAllLearning).some(
                      (x) => x.id === l.language_id,
                    ) && (
                      <option value={l.language_id}>
                        {label(l.language_id)}
                      </option>
                    )}
                  </Select>
                </div>
                <div className="w-24">
                  <Select
                    aria-label="Level"
                    value={l.level}
                    onChange={(e) =>
                      patch(i, {
                        level: e.target.value as UserLanguage['level'],
                      })
                    }
                  >
                    {LEARNER_LEVELS.map((lv) => (
                      <option key={lv}>{lv}</option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove language"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                >
                  <X size={18} />
                </Button>
              </div>
            ),
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addLearning}
          >
            Add a language
          </Button>
          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllLearning((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              More languages ({rest.length})
              <ChevronDown
                size={14}
                className={clsx('transition', showAllLearning && 'rotate-180')}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
