import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyPath, type MyPath } from '@/services/path';
import { Notice } from '@/components/ui';

/** The verified level comes from the learning path now: this shows where it stands and links to the profile. */
export function LevelProgress({ language }: { language: string }) {
  const [data, setData] = useState<MyPath | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; getMyPath().then((p) => { if (live) setData(p); }).catch(() => { if (live) setFailed(true); }); return () => { live = false; }; }, []);
  if (failed) return <p className="text-xs text-muted">Couldn't load your level.</p>;
  if (!data) return null;
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <BadgeCheck size={16} aria-hidden className={data.verified_level ? 'text-accent' : 'text-muted'} />
        {data.verified_level ? `Verified at ${data.verified_level} in ${language}` : `Not verified in ${language} yet`}
      </p>
      <p className="text-xs text-muted">Your level is the highest one you've passed. Each level needs topic calls with {data.settings.partners_needed} different people and {data.settings.pass_pct}% from their ratings.
        {data.current_band && <> You're working on {data.current_band}. </>}<Link to="/profile" className="text-brand underline">See your level</Link></p>
      <CorrectionRatings progress={data} />
      <div className="border-t border-border pt-2">
        <p className="text-sm font-semibold text-ink">Your contribution</p>
        <p className="text-xs text-muted">
          {data.contribution.posts} {data.contribution.posts === 1 ? 'post' : 'posts'} · {data.contribution.corrections_given} {data.contribution.corrections_given === 1 ? 'correction' : 'corrections'} given, {data.contribution.corrections_accepted} accepted · {data.contribution.points} points
          {data.contribution.response.decided > 0 && ` · ${data.contribution.response.on_time} of ${data.contribution.response.decided} decisions answered on time`}.
        </p>
      </div>
    </div>
  );
}

/** How people rated my corrections, and whether that has paused my +5. */
export function CorrectionRatings({ progress: p }: { progress: Pick<MyPath, 'rated' | 'not_helpful' | 'rewards_paused'> }) {
  if (p.rewards_paused) {
    return (
      <Notice tone="warning" small className="flex gap-2">
        <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>Most recent ratings of your corrections were “not helpful”, so they aren't earning points right now. New helpful corrections bring this back.</span>
      </Notice>
    );
  }
  if (!p.rated) return null;
  return <p className="text-xs text-muted">{p.rated - p.not_helpful} of your last {p.rated} rated corrections were helpful.</p>;
}
