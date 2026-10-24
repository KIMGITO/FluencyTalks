import type { MyProfile } from '@/types/db';


export function canCorrect(
  me: Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'learning_level'> | null,
  languageId: string | null,
): boolean {
  if (!languageId) return true;
  if (!me) return false;
  if (me.native_language_id === languageId) return true;
  return me.learning_language_id === languageId && ['B1', 'B2', 'C1', 'C2'].includes(me.learning_level ?? '');
}
