
import type { Message } from '@/types/db';

export interface DayGroup { key: string; label: string; messages: Message[] }

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}


export function groupByDay(messages: Message[], now = new Date()): DayGroup[] {
  return groupItemsByDay(messages, (m) => m.created_at, now).map((g) => ({ key: g.key, label: g.label, messages: g.items }));
}

/** The same grouping for anything with a time, such as messages and calls together. Items must be in time order. */
export function groupItemsByDay<T>(items: T[], at: (t: T) => string, now = new Date()): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  const index = new Map<string, (typeof groups)[number]>();
  for (const it of items) {
    const key = dayKey(at(it));
    let g = index.get(key);
    if (!g) { g = { key, label: dayLabel(at(it), now), items: [] }; index.set(key, g); groups.push(g); }
    g.items.push(it);
  }
  return groups;
}


export function isClusterStart(prev: Message | undefined, cur: Message): boolean {
  if (!prev) return true;
  if (prev.sender_id !== cur.sender_id) return true;
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 2 * 60 * 1000;
}
