/** WhatsApp-style day grouping: oldest-first input -> [{ key, label, messages }]. */
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

/** Bucket an oldest-first list into localized date partitions. Pure + stable. */
export function groupByDay(messages: Message[], now = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  for (const m of messages) {
    const key = dayKey(m.created_at);
    let g = index.get(key);
    if (!g) { g = { key, label: dayLabel(m.created_at, now), messages: [] }; index.set(key, g); groups.push(g); }
    g.messages.push(m);
  }
  return groups;
}

/** True when this message starts a new visual cluster (new sender or >2 min gap). */
export function isClusterStart(prev: Message | undefined, cur: Message): boolean {
  if (!prev) return true;
  if (prev.sender_id !== cur.sender_id) return true;
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 2 * 60 * 1000;
}
