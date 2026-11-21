import { useState } from 'react';
import { MoreHorizontal, MoreVertical } from 'lucide-react';
import { Button, MenuItem } from '@/components/ui';
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
      <Button variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label="More options" onClick={() => setOpen(!open)}><MoreVertical size={16} /></Button>
      {open && (
        <div className="ft-menu right-0 mt-1.5">
          <MenuItem onClick={() => { setOpen(false); setReport(true); }}>Report</MenuItem>
          <MenuItem danger onClick={block}>Block</MenuItem>
        </div>)}
      <ReportDialog open={report} onClose={() => setReport(false)} userId={userId} conversationId={conversationId} />
    </div>
  );
}
