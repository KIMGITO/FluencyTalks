
export function formatTime(iso: string) {
  const d = new Date(iso); const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Short relative time for feed items: "just now", "30min ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** "Online", "Active 5min ago", or nothing when we may not know. */
export function activityLabel(seen?: { online: boolean; last_seen_at: string | null } | null) {
  if (seen?.online) return 'Online';
  return seen?.last_seen_at ? `Active ${timeAgo(seen.last_seen_at)}` : '';
}

/** How long something has been waiting, for "waiting 2d". */
export function waited(iso: string) {
  const ago = timeAgo(iso);
  return ago === 'just now' ? 'under a minute' : ago.replace(' ago', '');
}
