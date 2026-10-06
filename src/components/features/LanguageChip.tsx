import clsx from 'clsx';
import { levelColors } from '@/theme/tokens';

export type Level = keyof typeof levelColors;
export type LanguageEntry = { language: string; level: Level };

// Full literal class strings so Tailwind can detect them
const tone: Record<string, string> = {
  'lvl-a': 'bg-lvl-a/10 text-lvl-a',
  'lvl-b': 'bg-lvl-b/10 text-lvl-b',
  'lvl-c': 'bg-lvl-c/10 text-lvl-c',
  'lvl-n': 'bg-lvl-n/10 text-lvl-n',
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
      tone[levelColors[level]],
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
