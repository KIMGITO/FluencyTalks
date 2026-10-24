import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { ContributionPost, Person, SavedPartner } from '@/types/db';

export const listSavedPartners = async (): Promise<SavedPartner[]> => {
  const { data } = await supabase.from('saved_partners').select('*').order('created_at', { ascending: false });
  return ((data ?? []) as SavedPartner[]).map(({ user_id, partner_id, created_at }) => ({ user_id, partner_id, created_at }));
};

export const savePartner = (partnerId: string) => rpc<string>('save_partner', { p_partner: partnerId });
export const deletePartner = (partnerId: string) => rpc<string>('delete_partner', { p_partner: partnerId });
export const listSavedPartnerIds = () => rpc<string[]>('list_saved_partner_ids');


export const isContributionEligible = (me: { native_language_id: string | null; learning_language_id: string | null; learning_level: string | null } | null) => {
  if (!me) return false;
  if (me.native_language_id) return true;
  const lvl = (me.learning_level ?? '').toUpperCase();
  return lvl === 'B1' || lvl === 'B2' || lvl === 'C1' || lvl === 'C2';
};

export const matchLanguage = (
  otherLanguages: { language_id: string; role: string; level: string }[] | null,
  myNative: string | null,
  myLearning: string | null,
  myLearningLevel?: string,
) => {
  if (!otherLanguages?.length) return null;
  if (myNative) {
    const native = otherLanguages.find((l) => l.language_id === myNative);
    if (native?.role === 'native') return { matched: 'native', language: myNative };
  }
  if (myLearning && myLearningLevel) {
    const match = otherLanguages.find((l) => l.language_id === myLearning && l.role === 'learning' && l.level === myLearningLevel);
    if (match) return { matched: 'learning', language: myLearning };
  }
  if (myNative) {
    const shared = otherLanguages.find((l) => l.role === 'native' && l.language_id === myNative);
    if (shared) return { matched: 'native', language: myNative };
  }
  return null;
};


export interface MatchPerson extends Person { match_kind: 'native' | 'learning' | 'other'; match_language: string | null }

export const searchMatched = (query: string, language: string | null, level: string | null, limit = 24) =>
  rpc<MatchPerson[]>('search_people', {
    p_query: query.trim() || null,
    p_language: language || null,
    p_level: level || null,
    p_limit: limit,
  });

export const listPeople = (limit = 24) => rpc<Person[]>('list_people', { p_limit: limit });
