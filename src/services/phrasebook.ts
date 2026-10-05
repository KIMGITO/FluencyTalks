import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { SavedPhrase } from '@/types/db';
/** `languageCode` is the ISO 639-3 id the translation was made into; the RPC normalises and validates it. */
export const savePhrase = (p: { phrase: string; translation?: string; languageCode?: string; sourceMessageId?: string }) =>
  rpc<string>('save_phrase', { p_phrase: p.phrase, p_translation: p.translation ?? null, p_language: p.languageCode ?? null, p_source: p.sourceMessageId ?? null });
/** Embeds the source message's conversation so each phrase can link back to the chat it came from. */
export const listPhrases = async () => {
  const { data } = await supabase.from('saved_phrases').select('*, source:messages(conversation_id)').order('created_at', { ascending: false });
  return ((data ?? []) as (SavedPhrase & { source: { conversation_id: string } | null })[])
    .map(({ source, ...p }) => ({ ...p, conversation_id: source?.conversation_id ?? null }));
};
export const deletePhrase = async (id: string) => { await supabase.from('saved_phrases').delete().eq('id', id); };
