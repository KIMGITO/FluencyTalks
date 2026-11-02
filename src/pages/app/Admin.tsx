import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Tabs } from '@/components/ui';
import { AdminActivity, AdminReports, AdminUsers } from '@/components/features/admin';
import { AdminDecisions } from '@/components/features/admin/AdminDecisions';
type Tab = 'reports' | 'decisions' | 'people' | 'activity';
export default function Admin() {
  const [tab, setTab] = useState<Tab>('reports');
  return (
    <>
      <PageHeader title="Moderation" subtitle="Review reports and manage accounts" />
      <div className="ft-inset mb-4"><Tabs value={tab} onChange={setTab} items={[{ key: 'reports', label: 'Reports' }, { key: 'decisions', label: 'Decisions' }, { key: 'people', label: 'People' }, { key: 'activity', label: 'Activity' }]} /></div>
      {tab === 'reports' ? <AdminReports /> : tab === 'decisions' ? <AdminDecisions /> : tab === 'people' ? <AdminUsers /> : <AdminActivity />}
    </>
  );
}
