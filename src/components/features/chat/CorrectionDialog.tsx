import { useEffect, useState } from 'react';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { DiffText } from './DiffText';
import type { Message } from '@/types/db';
import { useProfileStore } from '@/store/profileStore';

export function CorrectionDialog({ message, onClose, onSubmit }: { message: Message | null; onClose: () => void; onSubmit: (text: string, note: string) => Promise<void> }) {
  const [text, setText] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const me = useProfileStore((s) => s.me);
  const myLanguages = useProfileStore((s) => s.languages);
  const myProficiency = myLanguages.find(l => l.language_id === message?.language_id)?.level || 'A1';

  useEffect(() => { setText(message?.body ?? ''); setNote(''); setError(''); }, [message?.id]);
  const unchanged = !message || text.trim() === message.body.trim();
  const canEdit = message && (myProficiency !== 'A1' && myProficiency !== 'A2'); // Simple logic: block beginners
  
  const submit = async () => { setBusy(true); setError(''); try { await onSubmit(text.trim(), note.trim()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return (
    <Modal open={!!message} onClose={onClose} title="Suggest a correction">
      {message && (<>
        {!canEdit && <p className="text-sm text-danger mb-2">You need higher proficiency to suggest corrections.</p>}
        <Textarea label="Corrected version" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} disabled={!canEdit} />
        {!unchanged && <div className="rounded-md bg-surface-2 p-3 text-sm"><DiffText original={message.body} corrected={text} /></div>}
        <Input label="Why? (optional)" maxLength={500} value={note} placeholder="A short explanation helps them learn" onChange={(e) => setNote(e.target.value)} disabled={!canEdit} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={unchanged || !canEdit} onClick={submit}>Send correction</Button></div>
      </>)}
    </Modal>
  );
}
