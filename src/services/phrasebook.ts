import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { SavedPhrase } from '@/types/db';

export const savePhrase = (p: { phrase: string; translation?: string; languageCode?: string; sourceMessageId?: string }) =>
  rpc<string>('save_phrase', { p_phrase: p.phrase, p_translation: p.translation ?? null, p_language: p.languageCode ?? null, p_source: p.sourceMessageId ?? null });

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
export const deletePhrase = async (id: string) => { await supabase.from('saved_phrases').delete().eq('id', id); };
