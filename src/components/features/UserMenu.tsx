import { useState } from 'react';
import { MoreHorizontal, MoreVertical } from 'lucide-react';
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
      <Button variant="ghost"  size="sm" aria-label="More options" onClick={() => setOpen(!open)}><MoreVertical size={20} /></Button>
      {open && (
        <div className="ft-menu right-0 mt-1.5">
          <button className="ft-menu-item" onClick={() => { setOpen(false); setReport(true); }}>Report</button>
          <button className="ft-menu-item text-danger hover:bg-danger/10" onClick={block}>Block</button>
        </div>)}
      <ReportDialog open={report} onClose={() => setReport(false)} userId={userId} conversationId={conversationId} />
    </div>
  );
}
