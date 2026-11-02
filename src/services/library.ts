import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import { qualifiedLanguages } from '@/lib/corrections';
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

export interface Page { offset?: number; limit?: number }
const rangeOf = ({ offset = 0, limit = 12 }: Page = {}) => [offset, offset + limit - 1] as const;

export const listContributionPosts = async (p_languageId?: string, p_category?: string, page?: Page, myLanguagesFirst = false) => {
  let q = supabase.from('contribution_posts').select(POST_SELECT);
  // A computed column on the database (matches_my_languages): posts in my two languages, then the rest.
  if (myLanguagesFirst) q = q.order('matches_my_languages', { ascending: false });
  q = q.order('created_at', { ascending: false }).range(...rangeOf(page));
  if (p_languageId) q = q.eq('language_id', p_languageId);
  if (p_category) q = q.eq('category', p_category);
  const { data, error } = await q;
  if (error) throw error;
  return { posts: ((data ?? []) as PostRow[]).map(toPost) };
};
/** A person's posts, their pinned post first. */
export const listUserContributionPosts = async (userId: string, page?: Page) => {
  const { data, error } = await supabase
    .from('contribution_posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(...rangeOf(page));
  if (error) throw error;
  return { posts: ((data ?? []) as PostRow[]).map(toPost) };
};
/** Posts I saved, most recently saved first. */
export const listSavedPosts = async (page?: Page) => {
  const { data, error } = await supabase
    .from('saved_posts')
    .select(`created_at, post:contribution_posts(${POST_SELECT})`)
    .order('created_at', { ascending: false })
    .range(...rangeOf(page));
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


/** Can this person post at all? In which language is qualifiedLanguages' answer (the server checks too). */
export const isContributionEligible = (me: Parameters<typeof qualifiedLanguages>[0]) => qualifiedLanguages(me).length > 0;
