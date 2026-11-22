
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { startConversation } from '@/services';
import { MessageCircle } from 'lucide-react';
import { actionBtn, compactBtn, compactLabel } from './ActionButtonStyle';
import { userMessage } from '@/lib/errors';
import type { PersonStatus } from '@/services/connections';
import { ConnectButton } from './people/PeopleParts';

/**
 * Like calls, only partners message each other: given a `status`, nothing shows until you're partners.
 * `compact`: icon only on phones (label from `sm` up), for rows of actions that would otherwise wrap.
 */
export function MessageButton({ userId, status, compact }: { userId: string; status?: PersonStatus; compact?: boolean }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (status && status.connection !== 'connected') return null;
  const go = async () => {
    setBusy(true);
    setError('');
    try {
      nav(`/messages/${await startConversation(userId)}`);
    } catch (e) {
      setError(userMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      {compact ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={go} title="Message" className={compactBtn}>
          {!busy && <MessageCircle size={16} aria-hidden />}<span className={compactLabel}>Message</span>
        </Button>
      ) : (
        <Button size="sm" variant="secondary" loading={busy} onClick={go} className={actionBtn}>
          Message
        </Button>
      )}
      {error && <span className="text-xs leading-tight text-danger">{error}</span>}
    </div>
  );
}

/** On a card about someone: Message once you're partners, otherwise the partner request. */
export function MessageOrPartner({ userId, name, status, onChange }: { userId: string; name: string; status?: PersonStatus; onChange: (id: string, p: Partial<PersonStatus>) => void }) {
  if (status?.connection === 'connected') return <MessageButton userId={userId} />;
  return <ConnectButton userId={userId} name={name} status={status} onChange={onChange} />;
}
