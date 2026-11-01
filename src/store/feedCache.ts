import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * In-memory cache for paged lists (posts on Home, Library, profiles, Saved; the people feed).
 * Opening a page again shows what was loaded before at once; if it is older than STALE_MS the
 * first page is fetched again in the background and merged in. Further pages load on scroll.
 */
export const PAGE_SIZE = 12;
const STALE_MS = 60_000;

type Row = { id: string };
interface Entry { items: Row[]; done: boolean; fetchedAt: number; loading: boolean; error: string }
interface CacheState {
  entries: Record<string, Entry>;
  set: (key: string, patch: Partial<Entry>) => void;
  /** Drop a row (deleted post, blocked author) from every cached list. */
  removeEverywhere: (id: string) => void;
  /** Drop every row by this author from every cached list (after blocking them). */
  removeByUser: (userId: string) => void;
  /** Patch a row (pinned, saved, edited) in every cached list. */
  patchEverywhere: (id: string, patch: Record<string, unknown>) => void;
  /** Mark lists stale (all, or those whose key starts with `prefix`) so the next visit refreshes them. */
  invalidate: (prefix?: string) => void;
}

const empty: Entry = { items: [], done: false, fetchedAt: 0, loading: false, error: '' };

export const useFeedCache = create<CacheState>((set) => ({
  entries: {},
  set: (key, patch) => set((s) => ({ entries: { ...s.entries, [key]: { ...(s.entries[key] ?? empty), ...patch } } })),
  removeEverywhere: (id) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).map(([k, e]) => [k, { ...e, items: e.items.filter((r) => r.id !== id) }])),
  })),
  removeByUser: (userId) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).map(([k, e]) => [k, { ...e, items: e.items.filter((r) => (r as { user_id?: string }).user_id !== userId && r.id !== userId) }])),
  })),
  patchEverywhere: (id, patch) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).map(([k, e]) => [k, { ...e, items: e.items.map((r) => (r.id === id ? { ...r, ...patch } : r)) }])),
  })),
  invalidate: (prefix) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).map(([k, e]) => [k, !prefix || k.startsWith(prefix) ? { ...e, fetchedAt: 0 } : e])),
  })),
}));

/**
 * A cached, paged list. `fetchPage(offset, limit)` returns one page; fewer than `limit` rows means the end.
 * `key` must change whenever the query changes (filters, user id ...).
 */
export function usePagedList<T extends Row>(key: string | null, fetchPage: (offset: number, limit: number) => Promise<T[]>, pageSize = PAGE_SIZE) {
  const entry = useFeedCache((s) => (key ? s.entries[key] : undefined)) ?? empty;
  const setEntry = useFeedCache((s) => s.set);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  // First page: on first visit, or when stale (refresh in the background, keeping what is shown).
  const refresh = useCallback(async (force = false) => {
    if (!key) return;
    const cur = useFeedCache.getState().entries[key] ?? empty;
    if (cur.loading || (!force && cur.fetchedAt && Date.now() - cur.fetchedAt < STALE_MS)) return;
    setEntry(key, { loading: true, error: '' });
    try {
      const fresh = await fetchRef.current(0, pageSize);
      const prev = (useFeedCache.getState().entries[key] ?? empty).items;
      const ids = new Set(fresh.map((r) => r.id));
      // Keep the pages already loaded after the first one, so the list (and scroll position) survives a refresh.
      const tail = fresh.length < pageSize ? [] : prev.slice(pageSize).filter((r) => !ids.has(r.id));
      setEntry(key, { items: [...fresh, ...tail], done: fresh.length < pageSize && !tail.length, fetchedAt: Date.now(), loading: false });
    } catch (e) {
      console.error('Loading list failed', key, e);
      setEntry(key, { loading: false, error: (e as Error).message || 'Could not load.', fetchedAt: Date.now() });
    }
  }, [key, pageSize, setEntry]);

  const loadMore = useCallback(async () => {
    if (!key) return;
    const cur = useFeedCache.getState().entries[key] ?? empty;
    if (cur.loading || cur.done || !cur.fetchedAt) return;
    setEntry(key, { loading: true, error: '' });
    try {
      const page = await fetchRef.current(cur.items.length, pageSize);
      const ids = new Set(cur.items.map((r) => r.id));
      setEntry(key, { items: [...cur.items, ...page.filter((r) => !ids.has(r.id))], done: page.length < pageSize, loading: false });
    } catch (e) {
      setEntry(key, { loading: false, error: (e as Error).message || 'Could not load more.' });
    }
  }, [key, pageSize, setEntry]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = useCallback((fn: (items: T[]) => T[]) => {
    if (!key) return;
    setEntry(key, { items: fn((useFeedCache.getState().entries[key] ?? empty).items as T[]) });
  }, [key, setEntry]);

  return {
    items: entry.items as T[],
    /** True only while nothing is shown yet (first ever load). */
    initialLoading: !entry.fetchedAt && (entry.loading || !!key),
    loading: entry.loading,
    done: entry.done,
    error: entry.items.length ? '' : entry.error,
    loadMore,
    refresh: () => refresh(true),
    update,
  };
}

/** Calls `onVisible` when the returned ref's element scrolls into view (with a head start).
 *  `count` re-arms it after each page, so a sentinel that is still on screen loads the next one. */
export function useInfiniteScroll(onVisible: () => void, enabled: boolean, count = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) cb.current(); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, count]);
  return ref;
}
