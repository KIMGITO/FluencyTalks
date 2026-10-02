import { useCallback, useEffect, useState } from 'react';
import { EmptyState, Spinner, Tabs } from '@/components/ui';
import { ReportCard } from './ReportCard';
import { ModerationDialog, type ModTarget } from './ModerationDialog';
import { adminReportQueue } from '@/services';
import type { AdminReport } from '@/types/db';

type Filter = 'open' | 'actioned' | 'dismissed';
/** Report queue. Open reports are listed oldest first so nothing waits forever. */
export function AdminReports() {
  const [filter, setFilter] = useState<Filter>('open'); const [items, setItems] = useState<AdminReport[] | null>(null); const [error, setError] = useState(''); const [target, setTarget] = useState<ModTarget | null>(null);
  const load = useCallback(() => { setError(''); adminReportQueue(filter).then(setItems).catch((e) => { setError((e as Error).message); setItems([]); }); }, [filter]);
  useEffect(() => { setItems(null); load(); }, [load]);
  return (
    <div className="space-y-4">
      <Tabs value={filter} onChange={setFilter} items={[{ key: 'open', label: 'Open' }, { key: 'actioned', label: 'Actioned' }, { key: 'dismissed', label: 'Dismissed' }]} />
      {error && <p className="text-danger">{error}</p>}
      {!items ? <div className="flex justify-center p-6"><Spinner /></div>
        : !items.length ? <EmptyState title={filter === 'open' ? 'No open reports' : 'Nothing here'} text={filter === 'open' ? 'The queue is clear.' : undefined} />
        : items.map((r) => <ReportCard key={r.id} report={r} onAct={(userId, name, status, reportId) => setTarget({ userId, name, status, reportId })} onResolved={load} />)}
      <ModerationDialog target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); load(); }} />
    </div>
  );
}
