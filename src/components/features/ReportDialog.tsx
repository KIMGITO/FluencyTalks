import { useState } from 'react';
import { Button, Modal, Select, Textarea } from '@/components/ui';
import { REPORT_REASONS } from '@/lib/constants';
import { reportPost, reportUser, type ReportReason } from '@/services';
import { EMAILS, mailto } from '@/lib/emails';
import { userMessage } from '@/lib/errors';
import { cleanText } from '@/lib/validate';
/** Reports a person, or (with `postId`) one of their library posts — a snapshot of the post goes with the report. */
export function ReportDialog({ open, onClose, userId, conversationId, postId }: { open: boolean; onClose: () => void; userId: string; conversationId?: string; postId?: string }) {
  const [reason, setReason] = useState<ReportReason>('harassment'); const [details, setDetails] = useState(''); const [done, setDone] = useState(false); const [error, setError] = useState('');
  const submit = async () => { try { await (postId ? reportPost(postId, reason, cleanText(details) || undefined) : reportUser(userId, reason, cleanText(details) || undefined, conversationId)); setDone(true); } catch (e) { setError(userMessage(e)); } };
  return (
    <Modal open={open} onClose={onClose} title={postId ? 'Report this post' : 'Report this person'}>
      {done ? (<><p className="text-muted">{postId ? 'Thanks. Our team will review this post. A copy of it is attached to the report.' : 'Thanks. Our team will review this. The recent messages in this chat are attached to the report.'}</p><Button onClick={onClose}>Close</Button></>) : (<>
        <Select label="What's the problem?" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>{REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
        <Textarea label="Details (optional)" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <p className="text-sm text-muted">Prefer email? Write to <a className="underline" href={mailto(EMAILS.report, { subject: 'Report abuse' })}>{EMAILS.report}</a>. For urgent safety issues contact <a className="underline" href={mailto(EMAILS.security, { subject: 'Urgent safety issue' })}>{EMAILS.security}</a>.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit}>Send report</Button></div></>)}
    </Modal>
  );
}
