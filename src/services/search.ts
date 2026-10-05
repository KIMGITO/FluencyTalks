import { rpc } from '@/lib/api';
import type { MessageHit, Person } from '@/types/db';

/** One search box, one place where filters are turned into queries. `/search` is the only caller. */
export type SearchScope = 'everyone' | 'following';

export interface PeopleFilters {
  query?: string; language?: string; role?: string; level?: string;
  scope?: SearchScope; limit?: number; offset?: number;
}

export interface MessageFilters { query?: string; conversationId?: string; limit?: number; offset?: number }

/** The single people search: name or @username (with or without the "@"), plus language, role, level and who-you-follow filters. */
export const searchPeople = (f: PeopleFilters = {}) => rpc<Person[]>('search_people', {
  p_query: f.query?.trim() || null, p_language: f.language || null, p_role: f.role || null,
  p_level: f.level || null, p_scope: f.scope ?? 'everyone', p_offset: f.offset ?? 0,
  ...(f.limit == null ? {} : { p_limit: f.limit }),     // omitted, never null: a null would beat the SQL default (least(null,50) = 50)
});

/** Finds messages inside the conversations the viewer belongs to. */
export const searchMessages = (f: MessageFilters = {}) => rpc<MessageHit[]>('search_messages', {
  p_query: f.query?.trim() || null, p_conversation: f.conversationId ?? null, p_offset: f.offset ?? 0,
  ...(f.limit == null ? {} : { p_limit: f.limit }),
});