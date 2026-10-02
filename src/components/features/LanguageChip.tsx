import clsx from 'clsx';
import { levelColors } from '@/theme/tokens';
export type Level = keyof typeof levelColors;
const tone: Record<string, string> = { 'lvl-a': 'bg-lvl-a/15 text-lvl-a', 'lvl-b': 'bg-lvl-b/15 text-lvl-b', 'lvl-c': 'bg-lvl-c/15 text-lvl-c', 'lvl-n': 'bg-lvl-n/15 text-lvl-n' };
export const LanguageChip = ({ language, level }: { language: string; level: Level }) => (
  <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', tone[levelColors[level]])}>{language} · {level}</span>
);
