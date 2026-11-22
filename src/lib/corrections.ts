import type { MyProfile } from '@/types/db';

type Me = Pick<MyProfile, 'native_language_id' | 'learning_language_id' | 'verified_level'> | null;

/** The languages a person may teach in (Library posts and lessons): their native language only. */
export function teachingLanguages(me: Me): string[] {
  return me?.native_language_id ? [me.native_language_id] : [];
}

/**
 * The languages a person may correct in, the same rule as rating a call: their native language, plus their learning
 * language once they have passed a level there. Which authors they may correct (those working below the level they
 * passed) the server decides per message or post.
 */
export function correctingLanguages(me: Me): string[] {
  if (!me) return [];
  return [me.native_language_id, me.verified_level ? me.learning_language_id : null].filter((x): x is string => !!x);
}

export function canCorrect(me: Me, languageId: string | null): boolean {
  if (!languageId) return true;
  return correctingLanguages(me).includes(languageId);
}
