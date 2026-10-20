import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { Post, PostNote, PostReader, RichBlock } from '@/types/posts';

export const listPosts = (o: { kind?: string; mine?: boolean; saved?: boolean; limit?: number; offset?: number } = {}) =>
  rpc<Post[]>('list_posts', {
    p_kind: o.kind ?? null, p_mine: !!o.mine, p_saved: !!o.saved,
    p_limit: o.limit ?? 20, p_offset: o.offset ?? 0,
  });
export const getPost = (id: string) => rpc<Post[]>('get_post', { p_id: id }).then((r) => r[0] ?? null);

/** Public blog row: no per-user flags, safe for logged-out readers (see 0025_public_blogs.sql). */
export interface PublicBlog {
  id: string; title: string; blocks: RichBlock[]; body_text: string; language_id: string | null;
  created_at: string; author_name: string | null; author_username: string | null;
  author_avatar: string | null; read_count: number;
}
/** Blogs are the ONLY posts visible logged-out. Translation is NOT offered there —
 *  the page shows the text as written plus the language name. Logged-in readers
 *  get the full /posts/:id view with Translate. */
export const listPublicBlogs = (limit = 20, offset = 0) =>
  rpc<PublicBlog[]>('list_public_blogs', { p_limit: limit, p_offset: offset });
export const getPublicBlog = (id: string) =>
  rpc<PublicBlog[]>('get_public_blog', { p_id: id }).then((r) => r[0] ?? null);
export const createPost = (p: { kind: 'blog' | 'story'; title: string; blocks: RichBlock[]; bodyText: string; visibility: string; language?: string | null }) =>
  rpc<string>('create_post', { p_kind: p.kind, p_title: p.title, p_blocks: p.blocks, p_body_text: p.bodyText, p_visibility: p.visibility, p_language: p.language ?? null });
export const updatePost = (id: string, p: { title: string; blocks: RichBlock[]; bodyText: string; visibility?: string | null; language?: string | null }) =>
  rpc('update_post', { p_id: id, p_title: p.title, p_blocks: p.blocks, p_body_text: p.bodyText, p_visibility: p.visibility ?? null, p_language: p.language ?? null });
export const deletePost = (id: string) => rpc('delete_post', { p_id: id });
export const togglePostRead = (id: string) => rpc<boolean>('toggle_post_read', { p_id: id });
export const listPostReaders = (id: string) => rpc<PostReader[]>('list_post_readers', { p_id: id });
export const togglePostSave = (id: string) => rpc<boolean>('toggle_post_save', { p_id: id });
export const addPostNote = (id: string, note: string) => rpc<string>('add_post_note', { p_id: id, p_note: note });
export const listPostNotes = (id: string) => rpc<PostNote[]>('list_post_notes', { p_id: id });
export const deletePostNote = (id: string) => rpc('delete_post_note', { p_note: id });

/** Uploads to post-images/<uid>/post-<ts>.<ext> (storage policy = own folder). Returns public URL. */
export async function uploadPostImage(userId: string, file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase().slice(0, 5) || 'jpg';
  const path = `${userId}/post-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
}
