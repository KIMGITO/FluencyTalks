import clsx from 'clsx';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLevelProgress, type LevelEvidence, type LevelNeeds, type LevelProgress as Progress } from '@/services/levels';
import { useProfileStore } from '@/store/profileStore';

type Row = { label: string; value: string; pct: number; done: boolean };

const count = (label: string, have: number, need: number): Row =>
  ({ label, value: `${Math.min(have, need)} / ${need}`, pct: Math.min(100, (have / need) * 100), done: have >= need });

/** What still stands between this person and the next level. Empty requirements are left out. */
const rowsFor = (e: LevelEvidence, n: LevelNeeds, next: string | null): Row[] => {
  // A1 and A2 can come from posts; there the chat error rate waits until there is enough chat to judge.
  const early = next === 'A1' || next === 'A2';
  const partners = early ? e.partners_any : e.partners;
  const reviewed = early ? e.reviewed_any : e.reviewed;
  return [
  n.min_messages > 0 && count('Different messages', e.messages, n.min_messages),
  n.min_active_days > 0 && count('Days active', e.active_days, n.min_active_days),
  n.min_partners > 0 && count(early ? 'Native speakers who replied or fixed a post' : 'Native partners who replied', partners, n.min_partners),
  n.min_reviewed > 0 && count(early ? 'Messages and posts they reviewed' : 'Messages they reviewed', reviewed, n.min_reviewed),
  n.min_reviewed > 0 && n.max_error_pct < 100 && !(early && e.reviewed < n.min_reviewed) && {
    label: 'Recent messages needing a correction',
    value: e.error_pct == null ? `${n.max_error_pct}% or less` : `${e.error_pct}% (${n.max_error_pct}% or less)`,
    pct: e.error_pct == null ? 0 : Math.min(100, (n.max_error_pct / Math.max(e.error_pct, 1)) * 100),
    done: e.error_pct != null && e.error_pct <= n.max_error_pct,
  },
  n.min_accepted_given > 0 && count('Your corrections accepted', e.accepted_given, n.min_accepted_given),
  n.min_helpful_pct > 0 && e.rated >= 3 && {
    label: 'Your corrections rated helpful',
    value: `${e.helpful_pct ?? 0}% (${n.min_helpful_pct}% or more)`,
    pct: Math.min(100, ((e.helpful_pct ?? 0) / n.min_helpful_pct) * 100),
    done: (e.helpful_pct ?? 0) >= n.min_helpful_pct,
  },
  n.min_post_saves > 0 && count('Saves of your posts', e.post_saves, n.min_post_saves),
].filter((r): r is Row => !!r);
};

/** The verified level and the road to the next one. Reads and promotes on load. */
export function LevelProgress({ language }: { language: string }) {
  const me = useProfileStore((s) => s.me);
  const reload = useProfileStore((s) => s.load);
  const [data, setData] = useState<Progress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getLevelProgress()
      .then((p) => {
        if (!live) return;
        setData(p);
        if (me && p.verified_level !== (me.verified_level ?? null)) void reload(me.id);   // just promoted: rights changed
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [me?.id, me?.verified_level]);

  if (failed) return <p className="text-xs text-muted">Couldn't load your level progress.</p>;
  if (!data) return null;
  const rows = data.evidence && data.needs ? rowsFor(data.evidence, data.needs, data.next_level) : [];

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <BadgeCheck size={16} aria-hidden className={data.verified_level ? 'text-accent' : 'text-muted'} />
        {data.verified_level ? `Verified at ${data.verified_level} in ${language}` : `Not verified in ${language} yet`}
      </p>
      {data.next_level
        ? <p className="text-xs text-muted">Your level rises by itself as you chat with native speakers and make fewer errors{data.next_level === 'A1' || data.next_level === 'A2' ? ', or as they fix your “Correct me” posts' : ''}. To reach {data.next_level}:</p>
        : <p className="text-xs text-muted">You've reached the top level.</p>}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className={r.done ? 'text-muted' : 'text-ink'}>{r.label}</span>
                <span className={clsx('shrink-0 font-semibold', r.done ? 'text-muted' : 'text-ink')}>{r.value}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className={clsx('h-full rounded-full', r.done ? 'bg-brand' : 'bg-accent')} style={{ width: `${r.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.next_level && ['A1', 'A2', 'B1'].includes(data.next_level) && (
        <p className="text-xs text-muted">
          Faster route to B1: {data.vouches_needed} native speakers you've chatted with vouch for you, and your recent error rate holds.
          {data.vouches > 0 && ` You have ${data.vouches} of ${data.vouches_needed}.`}
        </p>
      )}
      <CorrectionRatings progress={data} />
    </div>
  );
}

/** How people rated my corrections, and whether that has paused my +5. */
export function CorrectionRatings({ progress: p }: { progress: Progress }) {
  if (p.rewards_paused) {
    return (
      <p className="flex gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
        <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>Most recent ratings of your corrections were “not helpful”, so they aren't earning points right now. New helpful corrections bring this back.</span>
      </p>
    );
  }
  if (!p.rated) return null;
  return <p className="text-xs text-muted">{p.rated - p.not_helpful} of your last {p.rated} rated corrections were helpful.</p>;
}
