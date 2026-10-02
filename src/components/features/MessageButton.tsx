import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { startConversation } from '@/services';
export function MessageButton({ userId }: { userId: string }) {
  const nav = useNavigate(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const go = async () => { setBusy(true); setError(''); try { nav(`/messages/${await startConversation(userId)}`); } catch (e) { setError((e as Error).message); setBusy(false); } };
  return (<span><Button size="sm" variant="secondary" loading={busy} onClick={go}>Message</Button>{error && <span className="ml-2 text-sm text-danger">{error}</span>}</span>);
}
