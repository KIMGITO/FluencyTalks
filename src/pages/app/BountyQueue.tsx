import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Spinner, Button } from '@/components/ui';
import { listMyBounties } from '@/services';
import { useProfileStore } from '@/store/profileStore';
import type { SavedPhrase } from '@/types/db';

export default function BountyQueue() {
  const me = useProfileStore((s) => s.me);
  const [bounties, setBounties] = useState<(SavedPhrase & { asker_username: string })[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me?.id) return;
    listMyBounties(me.id).then((r) => setBounties(r.bounties)).catch(() => setBounties([])).finally(() => setLoading(false));
  }, [me?.id]);

  if (loading || !me?.id) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  const myBounties = bounties?.filter((b) => b.bounty_asker_id === me.id) || [];

  return (
    <>
      <h1 className="text-2xl font-bold">Bounty Queue</h1>
      <p>Urgent questions waiting for native speakers to answer</p>
      {myBounties.length === 0 ? (
        <EmptyState
          title="No active bounties"
          text="You don't have any active bounties. Post one by spending 50 points on a language-specific question."
        />
      ) : (
        <div className="space-y-4">
          {myBounties.map((b) => (
            <div key={b.id} className="ft-card ft-card-pad flex flex-col gap-3">
              <p className="font-medium whitespace-pre-wrap break-words">{b.phrase}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Cost: {b.bounty_cost} pts</span>
                <span className="text-sm text-brand">Status: {b.bounty_status}</span>
              </div>
              {b.bounty_status === 'held' && (
                <Button size="sm" variant="secondary" onClick={() => window.alert('Bounty already in progress or accepted')}>
                  View Details
                </Button>
              )}
              {b.bounty_status === 'held' && (
                <Button size="sm" variant="danger" onClick={() => window.alert('This bounty has been accepted or expired')}>
                  Accept (if helper)
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Link to="/profile/edit">
          <Button size="sm">Post new bounty</Button>
        </Link>
      </div>
    </>
  );
}