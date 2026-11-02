import { useCallback, useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { EmptyState, ErrorState, RowListSkeleton, Tabs } from '@/components/ui';
import { ReportCard } from './ReportCard';
import { ModerationDialog, type ModTarget } from './ModerationDialog';
import { IconTile } from './AdminKit';
import { adminReportQueue } from '@/services';
import { useAdminStore } from '@/store/adminStore';
import type { AdminReport } from '@/types/db';

type Filter = 'open' | 'actioned' | 'dismissed';

export function AdminReports() {
  const [filter, setFilter] = useState<Filter>('open'); const [items, setItems] = useState<AdminReport[] | null>(null); const [failed, setFailed] = useState(false); const [target, setTarget] = useState<ModTarget | null>(null);
  const openCount = useAdminStore((s) => s.overview?.reports_open);
  const load = useCallback(() => { setFailed(false); adminReportQueue(filter).then(setItems).catch(() => setFailed(true)); }, [filter]);
  useEffect(() => { setItems(null); load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className="ft-inset"><Tabs value={filter} onChange={setFilter} items={[{ key: 'open', label: openCount ? `Open (${openCount})` : 'Open' }, { key: 'actioned', label: 'Actioned' }, { key: 'dismissed', label: 'Dismissed' }]} /></div>
      {failed ? <ErrorState title="Couldn't load the reports" onRetry={load} />
        : !items ? <RowListSkeleton label="Loading reports" />
        : !items.length ? <EmptyState icon={filter === 'open' ? <IconTile icon={PartyPopper} tone="success" /> : undefined} title={filter === 'open' ? 'The queue is clear' : 'Nothing here yet'} text={filter === 'open' ? 'No report is waiting for a decision.' : undefined} />
        : <div className="space-y-3">{items.map((r) => <ReportCard key={r.id} report={r} onAct={(userId, name, status, reportId) => setTarget({ userId, name, status, reportId })} onResolved={load} />)}</div>}
      <ModerationDialog target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); load(); }} />
    </div>
  );
}
