import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { CorrectionHistory, TranslationRecord } from '@/types/db';

/** Stores a completed translation; deduped per (user, text, language) in SQL. Fire-and-forget from the chat. `languageCode` is an ISO 639-3 id. */
export const saveTranslation = (t: { source: string; translated: string; languageCode?: string; sourceMessageId?: string }) =>
  rpc<string>('save_translation', { p_source: t.source, p_translated: t.translated, p_lang: t.languageCode ?? null, p_source_message: t.sourceMessageId ?? null });

export const listTranslations = async (): Promise<(TranslationRecord & { conversation_id: string | null })[]> => {
  const { data } = await supabase.from('translation_history').select('*, source:messages(conversation_id)').order('created_at', { ascending: false });
  return ((data ?? []) as (TranslationRecord & { source: { conversation_id: string } | null })[])
    .map(({ source, ...t }) => ({ ...t, conversation_id: source?.conversation_id ?? null }));
};

export const deleteTranslation = async (id: string) => { await supabase.from('translation_history').delete().eq('id', id); };

/** List points ledger entries for a user (audit trail) */
export const listPointsLedger = async (userId: string) => {
  const { data } = await supabase
    .from('points_ledger')
    .select('*, profiles!inner(display_name, username)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  let entries = ((data ?? []) as { profiles?: { display_name: string; username: string } | null; delta: number; reason: string; ref_type: string; ref_id: string; created_at: string }[])
    .map((e) => ({
      ...e,
      actor: e.profiles?.display_name || e.profiles?.username || 'system',
      action: e.delta > 0 ? 'earned' : 'spent',
      reason: e.reason,
    }));
  return entries;
};

/** Corrections that touched my messages, newest first — original text, corrector, status, conversation. */
export const listMyCorrections = async (): Promise<CorrectionHistory[]> => rpc<CorrectionHistory[]>('list_my_corrections');
