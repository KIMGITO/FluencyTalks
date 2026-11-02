import { create } from 'zustand';
import { markTabSeen, navBadges, type BadgeTab, type NavBadges } from '@/services';

interface S {
  counts: NavBadges;
  load: () => Promise<void>;
  /** Opening a tab clears its badge at once; the server remembers it for every device. */
  seen: (tab: BadgeTab) => void;
}
export const useBadgeStore = create<S>((set) => ({
  counts: {},
  load: async () => { try { set({ counts: await navBadges() }); } catch { /* a badge is never worth an error */ } },
  seen: (tab) => {
    set((s) => ({ counts: { ...s.counts, [tab]: 0 } }));
    markTabSeen(tab).catch(() => undefined);
  },
}));

/** Which badge a path belongs to, if any. */
export const badgeTabFor = (path: string): BadgeTab | null =>
  path.startsWith('/home') ? 'home' : path.startsWith('/library') ? 'library' : path.startsWith('/bounty-queue') ? 'bounties' : null;
