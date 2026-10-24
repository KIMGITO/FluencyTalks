import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import { languageLabel, sortKey } from '@/lib/languages';
import type { DisplayLanguage, FullProfile, Language, MyProfile, UserLanguage } from '@/types/db';

export const listLanguages = async (onlySupported = false): Promise<DisplayLanguage[]> => {
  let q = supabase
    .from('languages')
    .select('id, iso_639_1, english_name, native_name, is_supported_learning')
    .order('is_supported_learning', { ascending: false })
    .order('english_name');
  if (onlySupported) q = q.eq('is_supported_learning', true);
  const { data } = await q;
  return (data as Language[] ?? [])
    .map((l) => ({ ...l, label: languageLabel(l) }))
    .sort((a, b) => Number(b.is_supported_learning) - Number(a.is_supported_learning) || sortKey(a).localeCompare(sortKey(b)));
};


export const listCommonLanguages = (): Promise<DisplayLanguage[]> => listLanguages(true);
export const getProfile = (username: string) => rpc<FullProfile | null>('get_profile', { p_username: username });
export const setLanguageProfile = (p: { native: string; learning?: string | null; level?: string | null }) =>
  rpc('set_language_profile', { p_native: p.native, p_learning: p.learning || null, p_level: p.learning ? p.level ?? 'A1' : null });
export const saveProfile = (p: { username: string; displayName: string; bio: string; timezone: string; isPrivate: boolean; avatarUrl?: string; countryCode?: string | null }) =>
  rpc('save_profile', { p_username: p.username, p_display_name: p.displayName, p_bio: p.bio, p_timezone: p.timezone, p_is_private: p.isPrivate, p_avatar_url: p.avatarUrl ?? null, p_country: p.countryCode ?? null });

export async function uploadAvatar(userId: string, file: File) {
  const path = `${userId}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export const getMyProfile = async (id: string) => (await supabase.from('profiles').select('*').eq('id', id).single()).data as MyProfile | null;
export const getMyLanguages = async (id: string): Promise<UserLanguage[]> => {
  const { data } = await supabase.from('user_languages').select('language_id,role,level,languages!inner(native_name,english_name)').eq('user_id', id);
  type Row = { language_id: string; role: UserLanguage['role']; level: UserLanguage['level']; languages: { native_name: string | null; english_name: string | null } | { native_name: string | null; english_name: string | null }[] | null };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const lang = Array.isArray(r.languages) ? r.languages[0] ?? null : r.languages;
    return { language_id: r.language_id, role: r.role, level: r.level, native_name: lang?.native_name ?? null, english_name: lang?.english_name ?? null };
  });
};
