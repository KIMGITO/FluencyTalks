// How Home weaves its lists together. No imports, so it can be tested without a browser or Supabase.

export type FeedItem<P, U> = { kind: 'post'; post: P } | { kind: 'people'; people: U[] };

/** Posts between two rows of people. Uneven, so the feed doesn't feel like a pattern. */
const POST_RUNS = [3, 6, 5];
/** How often a request for help replaces the next ordinary post. */
const HELP_EVERY = 3;
/** People in one sideways row. Once posts have run out, one more row shows and the rest are a search away. */
const PEOPLE_IN_ROW = 6;

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
 * Posts and rows of people in one list, always opening with posts. A row's place depends only on how many posts come
 * before it, so loading the next page never moves what is on screen. People left over wait for more posts, and only
 * show at the end once `postsDone` says there are none to wait for.
 */
export function mixFeed<P, U>(posts: P[], people: U[], postsDone: boolean): { items: FeedItem<P, U>[]; morePeople: boolean } {
  const items: FeedItem<P, U>[] = [];
  let p = 0; let u = 0; let run = 0;
  while (p < posts.length) {
    const size = POST_RUNS[run++ % POST_RUNS.length];
    const end = p + size;
    for (; p < end && p < posts.length; p++) items.push({ kind: 'post', post: posts[p] });
    if (p === end && u < people.length) {
      items.push({ kind: 'people', people: people.slice(u, u + PEOPLE_IN_ROW) });
      u += PEOPLE_IN_ROW;
    }
  }
  if (!postsDone) return { items, morePeople: false };
  const left = people.slice(u, u + PEOPLE_IN_ROW);
  if (left.length) items.push({ kind: 'people', people: left });
  return { items, morePeople: u + left.length < people.length };
}
