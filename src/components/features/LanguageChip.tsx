import clsx from 'clsx';
import { levelColors } from '@/theme/tokens';

export type Level = keyof typeof levelColors;
export type LanguageEntry = { language: string; level: Level };

const levelTone: Record<string, string> = {
  'lvl_a': 'bg-indigo-100 text-indigo-900',
  'lvl_b': 'bg-blue-100 text-blue-900',
  'lvl_c': 'bg-green-100 text-green-900',
  'lvl_n': 'bg-gray-100 text-gray-900',
};

const isNative = (level: Level) => levelColors[level] === 'lvl-n';

export const LevelTag = ({
  level,
  className,
}: {
  level: Level;
  className?: string;
}) => (
  <span
    className={clsx(
      'rounded-full px-1.5 py-[3px] text-center text-[9px] font-bold uppercase leading-none tracking-wider',
      levelTone['lvl_' + levelColors[level]],
      className,
    )}
  >
    {level}
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
  languages.forEach(({ language, level }) => {
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
            <LevelTag level={level} className="w-full " />
          </dt>
          <dd className={`m-0 truncate text-[11.5px] leading-tight text-slate-600, text-${levelColors[level]}`}>
            {groups.get(level)!.join(', ')}
          </dd>
        </div>
      ))}
    </dl>
  );
};
