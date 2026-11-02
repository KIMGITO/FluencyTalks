import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Card, ErrorState, RowListSkeleton } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminOverview, type AdminOverview } from '@/services/admin';

const Stat = ({ label, value, hint }: { label: string; value: number; hint?: string }) => (
  <Card className="!rounded-lg !border">
    <p className="text-sm text-muted">{label}</p>
    <p className="mt-1 font-display text-3xl font-medium tabular-nums">{value.toLocaleString()}</p>
    {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
  </Card>
);

export function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null); const [failed, setFailed] = useState(false);
  const load = () => adminOverview().then((d) => { setData(d); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => { void load(); }, []);
  if (failed && !data) return <ErrorState title="Couldn't load the overview" onRetry={() => void load()} />;
  if (!data) return <RowListSkeleton label="Loading the overview" />;
  const todo = [
    { to: '/admin/reports', count: data.reports_open, text: data.reports_open === 1 ? 'report to decide' : 'reports to decide', note: data.reports_oldest_open ? `oldest from ${formatTime(data.reports_oldest_open)}` : undefined },
    { to: '/admin/decisions', count: data.appeals_open, text: data.appeals_open === 1 ? 'appeal to answer' : 'appeals to answer' },
    { to: '/admin/decisions', count: data.decisions_escalated, text: data.decisions_escalated === 1 ? 'escalated decision' : 'escalated decisions' },
    { to: '/admin/logs', count: data.errors_24h, text: data.errors_24h === 1 ? 'application error today' : 'application errors today' },
  ].filter((t) => t.count > 0);
  return (
    <div className="space-y-6">
      <section aria-labelledby="needs-you" className="space-y-2">
        <h2 id="needs-you" className="ft-inset font-semibold">Needs you</h2>
        {!todo.length ? (
          <Card className="flex items-center gap-2 text-sm"><CircleCheck size={18} aria-hidden className="text-success" /> Nothing is waiting for a decision.</Card>
        ) : (
          <Card pad={false} className="divide-y divide-border">
            {todo.map((t) => (
              <Link key={t.text} to={t.to} className="flex flex-wrap items-center gap-2 p-3 text-sm hover:bg-surface-2 md:px-4">
                <TriangleAlert size={18} aria-hidden className="text-accent" />
                <span><b className="tabular-nums">{t.count}</b> {t.text}</span>
                {t.note && <span className="text-xs text-muted">{t.note}</span>}
              </Link>
            ))}
          </Card>
        )}
      </section>
      <section aria-labelledby="community" className="space-y-2">
        <h2 id="community" className="ft-inset font-semibold">Community</h2>
        <div className="grid grid-cols-2 gap-3 px-3 md:px-0 lg:grid-cols-4">
          <Stat label="People" value={data.users_total} hint={`${data.users_new_7d.toLocaleString()} new this week`} />
          <Stat label="Active today" value={data.users_active_24h} />
          <Stat label="Messages today" value={data.messages_24h} />
          <Stat label="Posts this week" value={data.posts_7d} />
        </div>
      </section>
      <section aria-labelledby="safety" className="space-y-2">
        <h2 id="safety" className="ft-inset font-semibold">Safety</h2>
        <div className="grid grid-cols-2 gap-3 px-3 md:px-0 lg:grid-cols-4">
          <Stat label="Open reports" value={data.reports_open} />
          <Stat label="Suspended" value={data.users_suspended} />
          <Stat label="Banned" value={data.users_banned} />
          <Stat label="Posting paused" value={data.restrictions_active} />
        </div>
      </section>
    </div>
  );
}
