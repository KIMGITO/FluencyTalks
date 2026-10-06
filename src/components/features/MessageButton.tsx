// MessageButton.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { startConversation } from '@/services';
import { actionBtn } from './ActionButtonStyle';

export function MessageButton({ userId }: { userId: string }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      nav(`/messages/${await startConversation(userId)}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <Button size="sm" variant="secondary" loading={busy} onClick={go} className={actionBtn}>
        Message
      </Button>
      {error && <span className="text-xs leading-tight text-danger">{error}</span>}
    </div>
  );
}