import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { SavedPhrase } from '@/types/db';
export const savePhrase = (p: { phrase: string; translation?: string; languageCode?: string; sourceMessageId?: string }) =>
  rpc<string>('save_phrase', { p_phrase: p.phrase, p_translation: p.translation ?? null, p_language: p.languageCode ?? null, p_source: p.sourceMessageId ?? null });
export const listPhrases = async () => ((await supabase.from('saved_phrases').select('*').order('created_at', { ascending: false })).data ?? []) as SavedPhrase[];
export const deletePhrase = async (id: string) => { await supabase.from('saved_phrases').delete().eq('id', id); };
