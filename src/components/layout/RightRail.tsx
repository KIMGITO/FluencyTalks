import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { useProfileStore } from '@/store/profileStore';

export const RightRail = () => {
  const points = useProfileStore((s) => s.me?.points_balance);
  return (
    <aside className="sticky top-[var(--layout-topbarH)] hidden h-fit space-y-4 p-4 lg:block">
      <Card>
        <p className="ft-kicker">Today</p>
        <h3 className="mt-2 font-display text-xl font-medium">Daily prompt</h3>
        <p className="mt-1 text-sm text-muted">What did you eat for breakfast today? Tell someone in your learning language.</p>
      </Card>
      {points !== undefined && (
        <Card>
          <p className="ft-kicker">Your points</p>
          <p className="mt-2 font-display text-4xl font-medium leading-none">{points}</p>
          <p className="mt-2 text-sm text-muted">Earn more by helping with corrections.</p>
          <Link to="/bounty-queue" className="mt-3 inline-block text-sm font-bold text-ink underline decoration-accent decoration-2 underline-offset-4">See bounties</Link>
        </Card>
      )}
    </aside>
  );
};
