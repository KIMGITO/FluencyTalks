import { rpc } from '@/lib/api';
import { POST_CARD_COLUMNS, POST_COLUMNS, type DocNode, type Post, type PostCard } from '@/lib/blogHtml';
import { supabase } from '@/lib/supabase';

export interface BlogDraft {
  title: string; seo_title: string | null; description: string; kicker: string | null; summary: string;
  cover_url: string | null; cover_alt: string | null; body: DocNode | null;
}
export interface AdminPost {
  id: string; slug: string; draft: Partial<BlogDraft>; draft_saved_at: string; is_live: boolean; has_changes: boolean;
  live_title: string | null; published_at: string | null; updated_at: string | null; created_at: string;
}

export async function listLivePosts(limit = 100) {
  const { data, error } = await supabase.from('blog_posts').select(POST_CARD_COLUMNS).order('published_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PostCard[];
}
export async function getLivePost(slug: string) {
  const { data, error } = await supabase.from('blog_posts').select(POST_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data as unknown as Post | null;
}
/** What worker/index.ts already fetched for this page, so the browser doesn't ask again and the page doesn't flash. */
export function blogPayload<T>(path: string): T | null {
  if (typeof document === 'undefined') return null;
  try {
    const data = JSON.parse(document.getElementById('ft-blog-data')?.textContent ?? 'null');
    return data?.path === path ? data as T : null;
  } catch { return null; }
}

export const adminBlogList = () => rpc<AdminPost[]>('admin_blog_list');
export const adminBlogGet = (id: string) => rpc<AdminPost | null>('admin_blog_get', { p_id: id });
export const adminBlogSave = (id: string, slug: string, draft: BlogDraft, expected: string | null) =>
  rpc<AdminPost>('admin_blog_save', { p_id: id, p_slug: slug, p_draft: draft, p_expected: expected });
export const adminBlogPublish = (id: string) => rpc<AdminPost>('admin_blog_publish', { p_id: id });
export const adminBlogUnpublish = (id: string) => rpc<AdminPost>('admin_blog_unpublish', { p_id: id });

export async function adminBlogDelete(id: string) {
  await rpc('admin_blog_delete', { p_id: id });
  // The post is gone either way; a leftover image only takes up space.
  const bucket = supabase.storage.from('blog-images');
  const { data } = await bucket.list(id, { limit: 1000 });
  if (data?.length) await bucket.remove(data.map((f) => `${id}/${f.name}`));
}

const MAX_IMAGE_SIDE = 1600;

/** Photos straight from a camera are far bigger than a page needs. Anything that can't be converted goes up as it is. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.85));
    return blob && blob.type === 'image/webp' ? blob : file;
  } catch { return file; }
}

export async function uploadBlogImage(postId: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  const image = await shrinkImage(file);
  if (image.size > 5 * 1024 * 1024) throw new Error('That image is too large. The limit is 5 MB.');
  const ext = image.type.split('/')[1];
  const bucket = supabase.storage.from('blog-images');
  const path = `${postId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await bucket.upload(path, image, { contentType: image.type, cacheControl: '31536000' });
  if (error) throw new Error("Couldn't upload that image. Please try again.");
  return bucket.getPublicUrl(path).data.publicUrl;
}
