import clsx from 'clsx';
import { ChevronRight, Lock, LockOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { LEARNER_LEVELS, TEACHING_LEVELS } from '@/lib/constants';
import { languageIn } from '@/lib/languages';
import { useDisplayLocales, useLanguageStore, useLanguages } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { LanguageMark, LanguagePicker, type PickerOption } from './LanguagePicker';
import { LevelProgress } from './LevelProgress';

export type LearnerLevel = (typeof LEARNER_LEVELS)[number];

export interface LanguageChoice { native: string; learning: string; level: LearnerLevel }

const COOLDOWN_DAYS = 30;

const LEVEL_NAMES: Record<LearnerLevel, string> = {
  A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper intermediate', C1: 'Advanced', C2: 'Proficient',
};

export function languageLockedUntil(lastChange: string | null | undefined): Date | null {
  if (!lastChange) return null;
  const until = new Date(new Date(lastChange).getTime() + COOLDOWN_DAYS * 86_400_000);
  return until.getTime() > Date.now() ? until : null;
}

function LanguageField({ label, name, autonym, id, placeholder, locked, onOpen }: {
  label: string; name: string; autonym?: string | null; id: string; placeholder: string; locked: boolean; onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onOpen}
      aria-label={`${label}: ${name || placeholder}${locked ? ' (locked)' : ''}`}
      className={clsx(
        'group flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition',
        locked ? 'cursor-not-allowed bg-surface-2/60' : 'hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40',
      )}
    >
      <LanguageMark id={id} active={!!id} />
      <span className="min-w-0 flex-1">
        <span className="ft-kicker">{label}</span>
        <span className={clsx('mt-0.5 block truncate font-semibold', name ? 'text-ink' : 'text-muted')}>{name || placeholder}</span>
        {autonym && <span className="block truncate text-xs text-muted">{autonym}</span>}
      </span>
      {locked
        ? <Lock size={16} aria-hidden className="shrink-0 text-muted" />
        : <ChevronRight size={18} aria-hidden className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

function LevelPicker({ value, max, onChange }: { value: LearnerLevel; max: number; onChange: (level: LearnerLevel) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + max + 1) % (max + 1);
    onChange(LEARNER_LEVELS[next]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Your level" className="grid grid-cols-6 gap-1 rounded-md bg-surface-2 p-1">
      {LEARNER_LEVELS.map((lv, i) => (
        <button
          key={lv}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={lv === value}
          aria-label={`${lv}, ${LEVEL_NAMES[lv]}${i > max ? ' (earned through practice)' : ''}`}
          disabled={i > max}
          title={i > max ? 'Earned through practice' : undefined}
          tabIndex={lv === value ? 0 : -1}
          onClick={() => onChange(lv)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={clsx(
            'h-9 rounded-sm text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
            lv === value ? 'bg-brand text-on-brand shadow-card' : i > max ? 'cursor-not-allowed text-muted/40' : 'text-muted hover:bg-surface hover:text-ink',
          )}
        >
          {lv}
        </button>
      ))}
    </div>
  );
}

const Note = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <p className="flex gap-2 text-xs text-muted"><span className="mt-0.5 shrink-0">{icon}</span><span>{children}</span></p>
);

export function LanguageSelect({ value, onChange }: { value: LanguageChoice; onChange: (v: LanguageChoice) => void }) {
  const list = useLanguages();
  const locales = useDisplayLocales();
  const name = useLanguageStore((s) => s.nameIn);
  const me = useProfileStore((s) => s.me);
  const lockedUntil = languageLockedUntil(me?.last_language_change_at);
  // The cooldown covers replacing a language. Adding one for the first time is always free (server rule).
  const nativeLocked = !!lockedUntil && !!me?.native_language_id;
  const learningLocked = !!lockedUntil && !!me?.learning_language_id;
  const [picking, setPicking] = useState<'native' | 'learning' | null>(null);

  const options = useMemo(() => {
    const rows = (current: string, other: string): PickerOption[] => list
      .filter((l) => (l.is_supported_learning || l.id === current) && l.id !== other)
      .map((l) => {
        const main = languageIn(l, locales) || l.english_name;
        const autonym = l.native_name?.trim();
        return { id: l.id, name: main, english: l.english_name, autonym: autonym && autonym.toLowerCase() !== main.toLowerCase() ? autonym : null };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { native: rows(value.native, value.learning), learning: rows(value.learning, value.native) };
  }, [list, locales, value.native, value.learning]);

  const autonymOf = (id: string) => [...options.native, ...options.learning].find((o) => o.id === id)?.autonym ?? null;
  const learningName = value.learning ? name(value.learning, locales) : '';
  // Same language as saved: the level can only go down by hand. A new language takes any starting point.
  const savedLanguage = !!value.learning && value.learning === me?.learning_language_id;
  const maxLevel = savedLanguage ? LEARNER_LEVELS.indexOf(me?.learning_level as LearnerLevel) : LEARNER_LEVELS.length - 1;
  const canTeach = savedLanguage && TEACHING_LEVELS.includes(me?.verified_level ?? '');
  // A promotion can land while this form is open: show it, and never submit below what was earned.
  useEffect(() => {
    const earned = LEARNER_LEVELS.indexOf(me?.verified_level as LearnerLevel);
    if (savedLanguage && earned > LEARNER_LEVELS.indexOf(value.level)) onChange({ ...value, level: LEARNER_LEVELS[earned] });
  }, [savedLanguage, me?.verified_level]);
  // Saving a replaced language starts the cooldown, so say so before it happens.
  const replacesSaved = !lockedUntil && (
    (!!me?.native_language_id && me.native_language_id !== value.native) ||
    (!!me?.learning_language_id && me.learning_language_id !== value.learning));

  return (
    <div className="space-y-3">
      <LanguageField
        label="I speak natively"
        id={value.native}
        name={value.native ? name(value.native, locales) : ''}
        autonym={value.native ? autonymOf(value.native) : null}
        placeholder="Choose your native language"
        locked={nativeLocked}
        onOpen={() => setPicking('native')}
      />
      <LanguageField
        label="I'm learning (optional)"
        id={value.learning}
        name={learningName}
        autonym={value.learning ? autonymOf(value.learning) : null}
        placeholder="Not learning a language right now"
        locked={learningLocked}
        onOpen={() => setPicking('learning')}
      />

      {value.learning && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="ft-kicker">My {learningName} level</span>
            <span className="text-xs font-semibold text-ink">{LEVEL_NAMES[value.level]}</span>
          </div>
          <LevelPicker value={value.level} max={maxLevel} onChange={(level) => onChange({ ...value, level })} />
          <Note icon={canTeach ? <LockOpen size={13} aria-hidden className="text-accent" /> : <Lock size={13} aria-hidden />}>
            {canTeach
              ? `You can correct messages, answer bounties, earn points and post in ${learningName}.`
              : `This level is your own estimate. Correcting, answering bounties, earning points and posting in ${learningName} unlock once your activity verifies you at B1.`}
          </Note>
          {savedLanguage && <LevelProgress language={learningName} />}
        </div>
      )}

      <p className="text-xs text-muted">
        {lockedUntil
          ? `You changed languages recently. You can replace them again on ${lockedUntil.toLocaleDateString()}.`
          : replacesSaved
            ? `Saving this replaces a language, and you won't be able to replace one again for ${COOLDOWN_DAYS} days. Your verified level starts again in the new language.`
            : `Pick the language you'd happily correct others in, and at most one to learn. After your first change, languages can be replaced once every ${COOLDOWN_DAYS} days.`}
      </p>

      {picking && (
        <LanguagePicker
          title={picking === 'native' ? 'I speak natively' : "I'm learning"}
          value={value[picking]}
          options={options[picking]}
          clearLabel={picking === 'learning' ? 'Not learning a language right now' : undefined}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            // Back to the saved learning language: back to its saved level too, which can't be raised here.
            const level = picking === 'learning' && id === me?.learning_language_id ? (me.learning_level as LearnerLevel) : value.level;
            onChange({ ...value, level, [picking]: id });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
