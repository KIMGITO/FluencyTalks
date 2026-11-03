// How Home weaves its lists together. No imports, so it can be tested without a browser or Supabase.

export type FeedItem<P, U> = { kind: 'post'; post: P } | { kind: 'person'; person: U };

/** Posts between two people. Uneven, so the feed doesn't feel like a pattern. */
const POST_RUNS = [3, 5, 4];
/** How often a request for help replaces the next ordinary post. */
const HELP_EVERY = 3;
/** Once posts have run out, how many of the remaining people still show. The rest are a search away. */
const MAX_PEOPLE_AFTER_POSTS = 6;

/** Requests for help slotted into the feed from the second post on, each post once. */
export function weavePosts<P extends { id: string }>(feed: P[], help: P[]): P[] {
  const helpIds = new Set(help.map((p) => p.id));
  const rest = feed.filter((p) => !helpIds.has(p.id));
  const out: P[] = [];
  let h = 0; let r = 0;
  while (h < help.length || r < rest.length) {
    const helpTurn = out.length % HELP_EVERY === 1;
    if ((helpTurn && h < help.length) || r >= rest.length) out.push(help[h++]);
    else out.push(rest[r++]);
  }
  return out;
}

/**
 * Posts and people in one list, always opening with posts and with far more posts than people. A person's place depends
 * only on how many posts come before them, so loading the next page never moves what is on screen. People left over
 * wait for more posts, and only show at the end once `postsDone` says there are none to wait for.
 */
export function mixFeed<P, U>(posts: P[], people: U[], postsDone: boolean): { items: FeedItem<P, U>[]; morePeople: boolean } {
  const items: FeedItem<P, U>[] = [];
  let p = 0; let u = 0; let run = 0;
  while (p < posts.length) {
    const size = POST_RUNS[run++ % POST_RUNS.length];
    const end = p + size;
    for (; p < end && p < posts.length; p++) items.push({ kind: 'post', post: posts[p] });
    if (p === end && u < people.length) items.push({ kind: 'person', person: people[u++] });
  }
  if (!postsDone) return { items, morePeople: false };
  const left = people.slice(u, u + MAX_PEOPLE_AFTER_POSTS);
  for (const person of left) items.push({ kind: 'person', person });
  return { items, morePeople: u + left.length < people.length };
}
