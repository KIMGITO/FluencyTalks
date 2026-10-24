import type { MyProfile } from '@/types/db';

/**
 * Who may correct a message written in `languageId`: a native speaker of it, or a learner at B1 or
 * above. The database enforces the same rule (can_correct_language); this only lets the UI explain it.
 * A message without a language tag (older messages) can be corrected by anyone in the chat.
 */
export function canCorrect(
  me: Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'learning_level'> | null,
  languageId: string | null,
): boolean {
  if (!languageId) return true;
  if (!me) return false;
  if (me.native_language_id === languageId) return true;
  return me.learning_language_id === languageId && ['B1', 'B2', 'C1', 'C2'].includes(me.learning_level ?? '');
}
