import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { FullProfile, LanguageRef, UserLanguage } from '@/types/db';

export const listLanguages = async () => (await supabase.from('languages').select('*').order('name')).data as LanguageRef[] ?? [];
// People search lives in ./search (one central place for the /search page).
export const getProfile = (username: string) => rpc<FullProfile | null>('get_profile', { p_username: username });
export const setMyLanguages = (languages: UserLanguage[]) => rpc('set_my_languages', { p_languages: languages });
export const saveProfile = (p: { username: string; displayName: string; bio: string; timezone: string; isPrivate: boolean; avatarUrl?: string }) =>
  rpc('save_profile', { p_username: p.username, p_display_name: p.displayName, p_bio: p.bio, p_timezone: p.timezone, p_is_private: p.isPrivate, p_avatar_url: p.avatarUrl ?? null });

/** Uploads to avatars/<uid>/avatar-<ts>.<ext> (storage policy restricts writes to your own folder). Returns the public URL. */
export async function uploadAvatar(userId: string, file: File) {
  const path = `${userId}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

import type { MyProfile } from '@/types/db';
export const getMyProfile = async (id: string) => (await supabase.from('profiles').select('*').eq('id', id).single()).data as MyProfile | null;
export const getMyLanguages = async (id: string) => ((await supabase.from('user_languages').select('language_code,role,level').eq('user_id', id)).data ?? []) as UserLanguage[];
