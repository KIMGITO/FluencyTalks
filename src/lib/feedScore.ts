import type { Post } from '@/types/posts';

/**
 * Home story ranking: Score = Affinity x Weight x TimeDecay (FB EdgeRank style).
 * - Affinity: language I'm learning (3) > language I share natively (2)
 *   > same country/timezone region (1.5) > everything else (1).
 * - Weight: reads + notes show the story teaches well (log-damped, blogs weigh more).
 * - TimeDecay: halves roughly every 3 days so fresh stories surface.
 */
export function scorePost(
  p: Pick<Post, 'language_id' | 'read_count' | 'notes_count' | 'created_at' | 'kind' | 'author_country' | 'author_timezone'>,
  me: { learning: string[]; native: string[]; country: string | null; timezone: string | null },
): number {
  const lang = (p.language_id ?? '').toLowerCase();
  let affinity = 1;
  if (lang && me.learning.some((l) => l.toLowerCase() === lang)) affinity = 3;
  else if (lang && me.native.some((l) => l.toLowerCase() === lang)) affinity = 2;
  else if (
    (p.author_country && me.country && p.author_country === me.country) ||
    (p.author_timezone && me.timezone && p.author_timezone === me.timezone)
  ) affinity = 1.5;
  const engagement = p.read_count + p.notes_count * 2 + (p.kind === 'blog' ? 2 : 0);
  const weight = 1 + Math.log10(1 + engagement);
  const ageHrs = Math.max(0, (Date.now() - new Date(p.created_at).getTime()) / 3_600_000);
  const decay = Math.pow(0.5, ageHrs / 72);
  return affinity * weight * decay;
}

export const rankPosts = <
  T extends Pick<Post, 'language_id' | 'read_count' | 'notes_count' | 'created_at' | 'kind' | 'author_country' | 'author_timezone'>,
>(
  rows: T[],
  me: { learning: string[]; native: string[]; country: string | null; timezone: string | null },
): T[] => [...rows].sort((a, b) => scorePost(b, me) - scorePost(a, me));
