import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfileStore } from '@/store/profileStore';
import { EmptyState, Spinner, Button } from '@/components/ui';
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

export default function PointsHistory() {
  const me = useProfileStore((s) => s.me);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me?.id) return;
    listPointsLedger(me.id).then(setLedger).catch(() => setLedger([])).finally(() => setLoading(false));
  }, [me?.id]);

  if (loading || !me?.id) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  const totalEarned = ledger?.filter((e) => e.action === 'earned').reduce((sum, e) => sum + e.delta, 0) || 0;
  const totalSpent = ledger?.filter((e) => e.action === 'spent').reduce((sum, e) => sum + Math.abs(e.delta), 0) || 0;

  return (
    <>
      <h1 className="text-2xl font-bold">Points History</h1>
      <p>Your points transaction history</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-medium">+{totalEarned} pts earned</span>
        <span className="text-lg text-brand">-{totalSpent} pts spent</span>
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
                  <td className="text-sm py-3 px-2">{entry.reason}</td>
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