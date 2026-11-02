import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { getVouchStatus, vouchFor, withdrawVouch, type VouchStatus } from '@/services/levels';
import { useLanguageStore } from '@/store/languageStore';

const WHY_NOT: Record<string, string> = {
  not_enough_chat: 'You can vouch once you have chatted more: at least 15 of their messages in it, over 2 or more days.',
  too_new: 'You can vouch after 7 days on The Fluency Talks.',
  low_ratings: "You can't vouch while most recent ratings of your corrections are “not helpful”.",
  limit: "You've used your 3 vouches for this month.",
};

/** On a learner's profile, for a native speaker of the language they're learning. */
export function VouchCard({ userId, name }: { userId: string; name: string }) {
  const nameOf = useLanguageStore((s) => s.name);
  const [status, setStatus] = useState<VouchStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => getVouchStatus(userId).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { void load(); }, [userId]);

  if (!status) return null;
  const why = !status.vouched && status.blocker ? WHY_NOT[status.blocker] : null;
  if (status.blocker && !why) return null;
  const act = (fn: (id: string) => Promise<unknown>) => async () => {
    setBusy(true); setError('');
    try { await fn(userId); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const language = nameOf(status.language);

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <BadgeCheck size={16} aria-hidden className="text-accent" /> Vouch for {name}'s {language}
      </p>
      <p className="text-xs text-muted">
        {status.vouched
          ? 'You vouched that they write at B1 or above. Two vouches from native speakers verify them at B1.'
          : why ?? `Only vouch if they really do write ${language} at B1 or above. Two vouches from native speakers verify them at B1, which lets them correct others and earn points.`}
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {status.vouched
        ? <Button size="sm" variant="secondary" loading={busy} onClick={act(withdrawVouch)}>Withdraw vouch</Button>
        : !why && <Button size="sm" loading={busy} onClick={act(vouchFor)}>They write at B1 or above</Button>}
    </div>
  );
}
