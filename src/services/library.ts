import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { ContributionPost, Person, SavedPartner } from '@/types/db';

export type { ContributionPost, SavedPartner };

// The author FK is named explicitly: saved_posts also links posts to profiles (many-to-many),
// so a bare `profiles(...)` embed is ambiguous and PostgREST rejects it (PGRST201).
const POST_SELECT = '*, user:profiles!contribution_posts_user_id_fkey(id, username, display_name, avatar_url), saved:saved_posts(post_id)';
type PostRow = Omit<ContributionPost, 'saved'> & { user: Person; saved: { post_id: string }[] | boolean };
const toPost = ({ user, saved, ...p }: PostRow) => ({
  ...p,
  saved: Array.isArray(saved) ? saved.length > 0 : !!saved,   // saved_posts RLS only returns my own rows
  author: { ...user, languages: [] },
});

export const listContributionPosts = async (p_languageId?: string, p_category?: string) => {
  let q = supabase
    .from('contribution_posts')
    .select(POST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (p_languageId) q = q.eq('language_id', p_languageId);
  if (p_category) q = q.eq('category', p_category);
  const { data, error, count } = await q;
  if (error) throw error;
  return { posts: ((data ?? []) as PostRow[]).map(toPost), total: count ?? 0 };
};
/** A person's posts, their pinned post first. */
export const listUserContributionPosts = async (userId: string) => {
  const { data, error, count } = await supabase
    .from('contribution_posts')
    .select(POST_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { posts: ((data ?? []) as PostRow[]).map(toPost), total: count ?? 0 };
};
/** Posts I saved, most recently saved first. */
export const listSavedPosts = async () => {
  const { data, error } = await supabase
    .from('saved_posts')
    .select(`created_at, post:contribution_posts(${POST_SELECT})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { post: PostRow | null }[]).filter((r) => r.post).map((r) => toPost(r.post!));
};


export const listSavedPartners = async (): Promise<SavedPartner[]> => {
  const { data } = await supabase.from('saved_partners').select('*').order('created_at', { ascending: false });
  return ((data ?? []) as SavedPartner[]).map(({ user_id, partner_id, created_at }) => ({ user_id, partner_id, created_at }));
};

export const savePartner = (partnerId: string) => rpc<string>('save_partner', { p_partner: partnerId });
export const deletePartner = (partnerId: string) => rpc<string>('delete_partner', { p_partner: partnerId });
export type TextAlign = ContributionPost['text_align'];
export const postContribution = (phrase: string, translation: string | null, languageId: string, category: string, sourceContext: string, unsplashUrl: string, textAlign: TextAlign = 'left') => rpc<string>('post_contribution', { p_phrase: phrase, p_translation: translation, p_language: languageId, p_category: category, p_source_context: sourceContext, p_unsplash_image_url: unsplashUrl, p_text_align: textAlign });
export const updateContribution = (id: string, phrase: string, translation: string | null, languageId: string, category: string, sourceContext: string | null, unsplashUrl: string | null, textAlign: TextAlign = 'left') => rpc<void>('update_contribution', { p_id: id, p_phrase: phrase, p_translation: translation, p_language: languageId, p_category: category, p_source_context: sourceContext, p_unsplash_image_url: unsplashUrl, p_text_align: textAlign });
export const pinContribution = (id: string, pinned: boolean) => rpc<void>('pin_contribution', { p_id: id, p_pinned: pinned });
/** Returns the new state: true = saved. */
export const toggleSavedPost = (id: string) => rpc<boolean>('toggle_saved_post', { p_post: id });
export const getContribution = async (id: string): Promise<ContributionPost | null> => {
  const { data, error } = await supabase.from('contribution_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ContributionPost | null;
};
export const deleteContribution = (id: string) => rpc<string>('delete_contribution', { p_id: id });

 
export const isContributionEligible = (me: { native_language_id: string | null; learning_language_id: string | null; learning_level: string | null } | null) => {
  if (!me) return false;
  if (me.native_language_id) return true;
  const lvl = (me.learning_level ?? '').toUpperCase();
  return lvl === 'B1' || lvl === 'B2' || lvl === 'C1' || lvl === 'C2';
};
