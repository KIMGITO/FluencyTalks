import type { MyProfile } from '@/types/db';


/** The languages a person is qualified to teach or correct: their native language, plus their learning language from B1. */
export function qualifiedLanguages(
  me: Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'learning_level'> | null,
): string[] {
  if (!me) return [];
  const ids = [me.native_language_id];
  if (['B1', 'B2', 'C1', 'C2'].includes(me.learning_level ?? '')) ids.push(me.learning_language_id);
  return ids.filter((x): x is string => !!x);
}

export function canCorrect(
  me: Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'learning_level'> | null,
  languageId: string | null,
): boolean {
  if (!languageId) return true;
  if (!me) return false;
  if (me.native_language_id === languageId) return true;
  return me.learning_language_id === languageId && ['B1', 'B2', 'C1', 'C2'].includes(me.learning_level ?? '');
}
