import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import { languageLabel, sortKey } from '@/lib/languages';
import type { DisplayLanguage, FullProfile, Language, MyProfile, UserLanguage } from '@/types/db';

/**
 * The pickable languages, English name never shown, native name when the browser can draw
 * it. `is_supported_learning` is filtered in SQL so a disabled language never reaches the
 * client, and the order is by the name the user actually reads.
 */
export const listLanguages = async (): Promise<DisplayLanguage[]> => {
  const { data } = await supabase
    .from('languages')
    .select('id, iso_639_1, english_name, native_name, is_supported_learning')
    .eq('is_supported_learning', true)
    .order('english_name');
  return (data as Language[] ?? [])
    .map((l) => ({ ...l, label: languageLabel(l) }))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
};
// People search lives in ./search (one central place for the /search page).
export const getProfile = (username: string) => rpc<FullProfile | null>('get_profile', { p_username: username });
/** Only the ISO 639-3 id travels; native_name/english_name are display fields and are dropped here. */
export const setMyLanguages = (languages: UserLanguage[]) =>
  rpc('set_my_languages', { p_languages: languages.map(({ language_id, role, level }) => ({ language_id, role, level })) });
export const saveProfile = (p: { username: string; displayName: string; bio: string; timezone: string; isPrivate: boolean; avatarUrl?: string; countryCode?: string | null }) =>
  rpc('save_profile', { p_username: p.username, p_display_name: p.displayName, p_bio: p.bio, p_timezone: p.timezone, p_is_private: p.isPrivate, p_avatar_url: p.avatarUrl ?? null, p_country: p.countryCode ?? null });

/** Uploads to avatars/<uid>/avatar-<ts>.<ext> (storage policy restricts writes to your own folder). Returns the public URL. */
export async function uploadAvatar(userId: string, file: File) {
  const path = `${userId}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export const getMyProfile = async (id: string) => (await supabase.from('profiles').select('*').eq('id', id).single()).data as MyProfile | null;
export const getMyLanguages = async (id: string) =>
  ((await supabase.from('user_languages').select('language_id,role,level').eq('user_id', id)).data ?? []) as UserLanguage[];
