import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfileStore } from '@/store/profileStore';
import { EmptyState, ErrorState, TableSkeleton, Button } from '@/components/ui';
import { listPointsLedger } from '@/services/history';

type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  ref_type: string;
  ref_id: string;
  created_at: string;
  actor: string;
  action: 'earned' | 'spent';
};

const REASONS: Record<string, string> = {
  correction_accepted: 'Correction accepted',
  bounty_answered_accepted: 'Bounty answer accepted',
  bounty_posted: 'Bounty posted (points held)',
  bounty_expired_refund: 'Bounty refunded',
  post_correction_accepted: 'Post correction accepted',
};

export default function PointsHistory() {
  const me = useProfileStore((s) => s.me);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = () => {
    if (!me?.id) return;
    setLoading(true); setFailed(false);
    listPointsLedger(me.id).then(setLedger).catch(() => setFailed(true)).finally(() => setLoading(false));
  };

  useEffect(load, [me?.id]);

  if (loading || !me?.id) {
    return <TableSkeleton />;
  }

  if (failed) return <ErrorState title="Couldn't load your points history" onRetry={load} />;

  const totalEarned = ledger?.filter((e) => e.action === 'earned').reduce((sum, e) => sum + e.delta, 0) || 0;
  const totalSpent = ledger?.filter((e) => e.action === 'spent').reduce((sum, e) => sum + Math.abs(e.delta), 0) || 0;

  return (
    <>
      <div className="ft-inset">
        <h1 className="text-2xl font-bold">Points History</h1>
        <p>Your points transaction history</p>
      </div>

      <div className="ft-inset mt-4 flex items-center justify-between">
        <span className="text-lg font-medium">+{totalEarned} pts earned</span>
        <span className="text-lg text-brand">-{totalSpent} pts spent</span>
      </div>

      <div className="ft-inset mt-4 text-sm text-muted">
        <p className="font-semibold text-ink">How points work</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>+5 when your correction, in chat or on a post, is accepted: up to 10 a day, and 3 a day from the same person.</li>
          <li>Asking the community holds 50 points. Whoever you accept gets them; after 48 hours with no accepted answer they come back.</li>
          <li>You correct and answer in your native language, or your learning language once your activity verifies you at B1.</li>
          <li>The people you correct can rate it. If most recent ratings are “not helpful”, from at least 3 people, your corrections stop earning until that recovers.</li>
        </ul>
      </div>

      {ledger?.length === 0 ? (
        <EmptyState
          title="No points activity yet"
          text="Points will appear here as you earn them through corrections and bounties."
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border-2">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-muted py-3 px-2">Date</th>
                <th className="text-left text-xs font-medium text-muted py-3 px-2">Action</th>
                <th className="text-left text-xs font-medium text-muted py-3 px-2">Reason</th>
                <th className="text-left text-xs font-medium text-muted py-3 px-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {ledger?.map((entry) => (
                <tr key={entry.id} className="hover:bg-brand-soft">
                  <td className="text-sm py-3 px-2">{new Date(entry.created_at).toLocaleDateString()}</td>
                  <td className="text-sm py-3 px-2">
                    <span className={entry.action === 'earned' ? 'text-success' : 'text-brand'}>
                      {entry.action} {entry.delta > 0 ? '+' + entry.delta : '-' + Math.abs(entry.delta)}
                    </span>
                  </td>
                  <td className="text-sm py-3 px-2">{REASONS[entry.reason] ?? entry.reason}</td>
                  <td className="text-sm py-3 px-2">
                    <span className={entry.action === 'earned' ? 'text-success' : 'text-brand'}>
                      {entry.delta > 0 ? '+' + entry.delta : '-' + Math.abs(entry.delta)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Link to="/profile/edit">
          <Button size="sm">Back to Profile</Button>
        </Link>
      </div>
    </>
  );
}