import { useState } from 'react';
import { Button, Modal, Select, Textarea } from '@/components/ui';
import { REPORT_REASONS } from '@/lib/constants';
import { reportUser, type ReportReason } from '@/services';
export function ReportDialog({ open, onClose, userId, conversationId }: { open: boolean; onClose: () => void; userId: string; conversationId?: string }) {
  const [reason, setReason] = useState<ReportReason>('harassment'); const [details, setDetails] = useState(''); const [done, setDone] = useState(false); const [error, setError] = useState('');
  const submit = async () => { try { await reportUser(userId, reason, details || undefined, conversationId); setDone(true); } catch (e) { setError((e as Error).message); } };
  return (
    <Modal open={open} onClose={onClose} title="Report this person">
      {done ? (<><p className="text-muted">Thanks. Our team will review this. The recent messages in this chat are attached to the report.</p><Button onClick={onClose}>Close</Button></>) : (<>
        <Select label="What's the problem?" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>{REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
        <Textarea label="Details (optional)" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit}>Send report</Button></div></>)}
    </Modal>
  );
}
