import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui';
import { blockUser } from '@/services';
import { ReportDialog } from './ReportDialog';
export function UserMenu({ userId, name, conversationId, onBlocked }: { userId: string; name: string; conversationId?: string; onBlocked?: () => void }) {
  const [open, setOpen] = useState(false); const [report, setReport] = useState(false);
  const block = async () => {
    setOpen(false);
    if (!confirm(`Block ${name}? They won't be notified. You'll both disappear from each other's view.`)) return;
    await blockUser(userId); onBlocked?.();
  };
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" aria-label="More options" onClick={() => setOpen(!open)}><MoreHorizontal size={20} /></Button>
      {open && (
        <div className="ft-card absolute right-0 z-30 mt-2 w-48 p-2 shadow-pop">
          <button className="w-full rounded-md p-2 text-left hover:bg-surface-2" onClick={() => { setOpen(false); setReport(true); }}>Report</button>
          <button className="w-full rounded-md p-2 text-left text-danger hover:bg-surface-2" onClick={block}>Block</button>
        </div>)}
      <ReportDialog open={report} onClose={() => setReport(false)} userId={userId} conversationId={conversationId} />
    </div>
  );
}
