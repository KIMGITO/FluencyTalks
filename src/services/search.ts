import { rpc } from '@/lib/api';
import { normalizeCode } from '@/lib/languages';
import type { MessageHit, Person } from '@/types/db';

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