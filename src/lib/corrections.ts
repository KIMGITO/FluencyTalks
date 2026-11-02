import { TEACHING_LEVELS } from '@/lib/constants';
import type { MyProfile } from '@/types/db';


/** The languages a person is qualified to teach or correct: their native language, plus their learning language once verified at B1. */
export function qualifiedLanguages(
  me: Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'verified_level'> | null,
): string[] {
  if (!me) return [];
  const ids = [me.native_language_id];
  if (TEACHING_LEVELS.includes(me.verified_level ?? '')) ids.push(me.learning_language_id);
  return ids.filter((x): x is string => !!x);
}

export function canCorrect(
  me: Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'verified_level'> | null,
  languageId: string | null,
): boolean {
  if (!languageId) return true;
  if (!me) return false;
  if (me.native_language_id === languageId) return true;
  return me.learning_language_id === languageId && TEACHING_LEVELS.includes(me.verified_level ?? '');
}
