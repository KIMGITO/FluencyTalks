import clsx from 'clsx';
import { BadgeCheck } from 'lucide-react';
import type { UserLanguage } from '@/types/db';
import { levelColors } from '@/theme/tokens';

export type Level = keyof typeof levelColors;
/** verified: true = earned through activity, false = the person's own estimate. Natives leave it out. */
export type LanguageEntry = { language: string; level: Level; verified?: boolean };

/** A learner is shown at the level they've earned. With none yet, their estimate, marked as such. */
export const languageEntry = (l: UserLanguage, language: string): LanguageEntry =>
  l.role === 'learning'
    ? { language, level: (l.verified_level ?? l.level) as Level, verified: !!l.verified_level }
    : { language, level: l.level as Level };

const isNative = (level: Level) => levelColors[level] === 'lvl-n';

export const LevelTag = ({
  level,
  verified,
  className,
}: {
  level: Level;
  verified?: boolean;
  className?: string;
}) => (
  <span
    className={clsx(
      'inline-flex items-center justify-center gap-0.5 rounded-sm px-1.5 py-[3px] text-center text-[9px] font-bold uppercase leading-none tracking-wider',
      // native = filled deep indigo, learner levels = outlined, so the difference reads at a glance
      isNative(level) ? 'bg-brand text-on-brand' : clsx('border text-ink', verified === false ? 'border-dashed border-ink/35' : 'border-ink/35'),
      className,
    )}
    title={verified ? 'Verified through activity' : verified === false ? 'Self-assessed' : undefined}
  >
    {level}
    {verified && <BadgeCheck size={10} aria-label="verified" className="text-accent" />}
  </span>
);

export const LanguageChip = ({
  languages,
  className,
}: {
  languages: LanguageEntry[];
  className?: string;
}) => {
  const groups = new Map<Level, string[]>();
  const verifiedOf = new Map<Level, boolean | undefined>();
  languages.forEach(({ language, level, verified }) => {
    verifiedOf.set(level, verified);
    const names = groups.get(level) ?? [];
    if (!names.includes(language)) groups.set(level, [...names, language]);
  });

  const order = Object.keys(levelColors) as Level[];
  const rows = [
    ...order.filter(isNative),
    ...order.filter((l) => !isNative(l)),
  ].filter((l) => groups.has(l));

  if (!rows.length) return null;

  return (
    <dl
      className={clsx(
        'm-0 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1',
        className,
      )}
    >
      {rows.map((level) => (
        <div key={level} className="contents">
          <dt className="flex">
            <LevelTag level={level} verified={verifiedOf.get(level)} className="w-full " />
          </dt>
          <dd className={`m-0 truncate text-[11.5px] leading-tight text-slate-600, text-${levelColors[level]}`}>
            {groups.get(level)!.join(', ')}
            {verifiedOf.get(level) === false && <span className="text-muted"> · self-assessed</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
};
