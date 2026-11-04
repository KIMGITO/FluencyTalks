import { supabase } from '@/lib/supabase';
import { ApiError, rpc } from '@/lib/api';
import type { SavedPhrase } from '@/types/db';

export const savePhrase = (p: { phrase: string; translation?: string; languageCode?: string; sourceMessageId?: string; sourcePostId?: string }) =>
  rpc<string>('save_phrase', { p_phrase: p.phrase, p_translation: p.translation ?? null, p_language: p.languageCode ?? null, p_source: p.sourceMessageId ?? null, p_source_post: p.sourcePostId ?? null });

export const listPhrases = async (p_languageId?: string) => {
  const { data } = await supabase
    .from('saved_phrases')
    .select('*, source:messages(conversation_id)', { count: 'exact' })
    .order('created_at', { ascending: false });
  let phrases = ((data ?? []) as (SavedPhrase & { source: { conversation_id: string } | null })[])
    .map(({ source, ...p }) => ({ ...p, conversation_id: source?.conversation_id ?? null }));
  if (p_languageId) {
    phrases = phrases.filter((p) => p.language_id === p_languageId);
  }
  return { phrases, total: phrases.length };
};
/** The text of everything I saved: the phrasebook holds one row per text, so that is what marks a message as saved. */
export const listSavedPhraseTexts = async () => {
  const { data, error } = await supabase.from('saved_phrases').select('phrase');
  if (error) throw error;
  return (data ?? []).map((r) => r.phrase as string);
};
export const unsavePhrase = async (phrase: string) => {
  const { error } = await supabase.from('saved_phrases').delete().eq('phrase', phrase);
  if (error) throw new ApiError('unknown', 'Could not remove it from your phrasebook. Please try again.');
};
export const deletePhrase = async (id: string) => { const { error } = await supabase.from('saved_phrases').delete().eq('id', id); if (error) throw error; };
