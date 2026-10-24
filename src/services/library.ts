import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { ContributionPost, Person, SavedPartner } from '@/types/db';

export type { ContributionPost, SavedPartner };

export const listContributionPosts = async (p_languageId?: string, p_category?: string) => {
  console.log('DEBUG: listContributionPosts called with', { p_languageId, p_category });
  let q = supabase
    .from('contribution_posts')
    .select('*, user:profiles(id, username, display_name, avatar_url)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (p_languageId) q = q.eq('language_id', p_languageId);
  if (p_category) q = q.eq('category', p_category);
  const { data, error, count } = await q;
  if (error) {
    console.error('DEBUG: listContributionPosts error:', error);
  }
  console.log('DEBUG: listContributionPosts result:', { dataCount: data?.length, count, data });
  return {
    posts: ((data ?? []) as (ContributionPost & { user: Person })[]).map(({ user, ...p }) => ({
      ...p,
      author: { ...user, languages: [] }
    })),
    total: count ?? 0,
  };
};
export const listUserContributionPosts = async (userId: string) => {
  console.log('DEBUG: listUserContributionPosts called for userId:', userId);
  const { data, error, count } = await supabase
    .from('contribution_posts')
    .select('*, user:profiles(id, username, display_name, avatar_url)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('DEBUG: listUserContributionPosts error:', error);
  }
  console.log('DEBUG: listUserContributionPosts result:', { dataCount: data?.length, count, data });

  return {
    posts: ((data ?? []) as (ContributionPost & { user: Person })[]).map(({ user, ...p }) => ({
      ...p,
      author: { ...user, languages: [] }
    })),
    total: count ?? 0,
  };
};


export const listSavedPartners = async (): Promise<SavedPartner[]> => {
  const { data } = await supabase.from('saved_partners').select('*').order('created_at', { ascending: false });
  return ((data ?? []) as SavedPartner[]).map(({ user_id, partner_id, created_at }) => ({ user_id, partner_id, created_at }));
};

export const savePartner = (partnerId: string) => rpc<string>('save_partner', { p_partner: partnerId });
export const deletePartner = (partnerId: string) => rpc<string>('delete_partner', { p_partner: partnerId });
export const postContribution = (phrase: string, translation: string | null, languageId: string, category: string, sourceContext: string, unsplashUrl: string) => rpc<string>('post_contribution', { p_phrase: phrase, p_translation: translation, p_language: languageId, p_category: category, p_source_context: sourceContext, p_unsplash_image_url: unsplashUrl });
export const deleteContribution = (id: string) => rpc<string>('delete_contribution', { p_id: id });

/** eligibility: native speaker or B1+ learner */ 
export const isContributionEligible = (me: { native_language_id: string | null; learning_language_id: string | null; learning_level: string | null } | null) => {
  if (!me) return false;
  if (me.native_language_id) return true;
  const lvl = (me.learning_level ?? '').toUpperCase();
  return lvl === 'B1' || lvl === 'B2' || lvl === 'C1' || lvl === 'C2';
};
