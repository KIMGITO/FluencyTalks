import { rpc } from '@/lib/api';
import { normalizeCode } from '@/lib/languages';
import type { ContributionPost, MessageHit, Person } from '@/types/db';

export type SearchScope = 'everyone';

export interface PeopleFilters {
  query?: string;
  language?: string;
  role?: string; level?: string;
  limit?: number; offset?: number;
}

export interface MessageFilters { query?: string; conversationId?: string; limit?: number; offset?: number }

export const searchPeople = (f: PeopleFilters = {}) => rpc<Person[]>('search_people', {
  p_query: f.query?.trim() || null, p_language: normalizeCode(f.language), p_role: f.role || null,
  p_level: f.level || null, p_offset: f.offset ?? 0,
  ...(f.limit == null ? {} : { p_limit: f.limit }),
});

export const searchMessages = (f: MessageFilters = {}) => rpc<MessageHit[]>('search_messages', {
  p_query: f.query?.trim() || null, p_conversation: f.conversationId ?? null, p_offset: f.offset ?? 0,
  ...(f.limit == null ? {} : { p_limit: f.limit }),
});

export interface PostFilters { query?: string; language?: string; limit?: number; offset?: number }
type PostHitRow = Omit<ContributionPost, 'author' | 'saved'> & { author_username: string; author_name: string | null; author_avatar: string | null; saved: boolean };

/** Library posts by text or author; blocked people and inactive authors are left out by the server. */
export const searchPosts = async (f: PostFilters = {}) => {
  const rows = await rpc<PostHitRow[]>('search_posts', {
    p_query: f.query?.trim() || null, p_language: normalizeCode(f.language), p_offset: f.offset ?? 0,
    ...(f.limit == null ? {} : { p_limit: f.limit }),
  });
  return (rows ?? []).map(({ author_username, author_name, author_avatar, ...p }) => ({
    ...p,
    author: { id: p.user_id, username: author_username, display_name: author_name, avatar_url: author_avatar },
  }));
};
export type PostHit = Awaited<ReturnType<typeof searchPosts>>[number];

export interface PhraseHit { id: string; phrase: string; translation: string | null; language_id: string | null; source_message_id: string | null; created_at: string }
/** Phrases in my own phrasebook. */
export const searchPhrases = (f: PostFilters = {}) => rpc<PhraseHit[]>('search_phrases', {
  p_query: f.query?.trim() || null, p_language: normalizeCode(f.language), p_offset: f.offset ?? 0,
  ...(f.limit == null ? {} : { p_limit: f.limit }),
});
