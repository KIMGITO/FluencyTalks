export type PostKind = 'blog' | 'story';
export type PostVisibility = 'public' | 'followers' | 'private';
export type BlockType = 'paragraph' | 'h1' | 'h2' | 'quote' | 'ul' | 'ol' | 'image';
export interface RichBlock {
  id: string;
  type: BlockType;
  text?: string;
  items?: string[];
  src?: string;
  caption?: string;
  link?: string | null;
}
export interface Post {
  id: string; kind: PostKind; title: string; blocks: RichBlock[];
  body_text: string; language_id: string | null; visibility: PostVisibility;
  created_at: string; updated_at: string; author_id: string;
  author_username: string | null; author_name: string | null; author_avatar: string | null;
  author_country: string | null; author_timezone: string | null;
  read_count: number; has_read: boolean; saved: boolean; notes_count: number;
}
export interface PostReader { id: string; username: string | null; display_name: string | null; avatar_url: string | null; read_at: string }
export interface PostNote { id: string; note: string; created_at: string; user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; mine: boolean }
