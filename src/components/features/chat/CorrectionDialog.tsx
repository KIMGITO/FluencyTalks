import { useEffect, useState } from 'react';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { DiffText } from './DiffText';
import type { Message } from '@/types/db';
export function CorrectionDialog({ message, onClose, onSubmit }: { message: Message | null; onClose: () => void; onSubmit: (text: string, note: string) => Promise<void> }) {
  const [text, setText] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setText(message?.body ?? ''); setNote(''); setError(''); }, [message?.id]);
  const unchanged = !message || text.trim() === message.body.trim();
  const submit = async () => { setBusy(true); setError(''); try { await onSubmit(text.trim(), note.trim()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return (
    <Modal open={!!message} onClose={onClose} title="Suggest a correction">
      {message && (<>
        <Textarea label="Corrected version" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
        {!unchanged && <div className="rounded-md bg-surface-2 p-3 text-sm"><DiffText original={message.body} corrected={text} /></div>}
        <Input label="Why? (optional)" maxLength={500} value={note} placeholder="A short explanation helps them learn" onChange={(e) => setNote(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={unchanged} onClick={submit}>Send correction</Button></div>
      </>)}
    </Modal>
  );
}
