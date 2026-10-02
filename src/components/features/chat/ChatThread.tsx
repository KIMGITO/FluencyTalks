import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Avatar, Button, EmptyState, Spinner } from '@/components/ui';
import { UserMenu } from '../UserMenu';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { CorrectionDialog } from './CorrectionDialog';
import { blockUser, savePhrase } from '@/services';
import type { Message } from '@/types/db';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useProfileStore } from '@/store/profileStore';

export function ChatThread({ id }: { id: string }) {
  const nav = useNavigate(); const myId = useAuthStore((s) => s.user?.id);
  const { open, close, messages, corrections, reactions, active, requests, send, respond, suggest, accept, dismiss, react } = useChatStore(); const endRef = useRef<HTMLDivElement>(null);
  const [correcting, setCorrecting] = useState<Message | null>(null);
  const translateTo = useProfileStore((s) => s.languages.find((l) => l.role === 'native')?.language_code ?? 'en');   // translate into my native language
  const row = [...active, ...requests].find((c) => c.conversation_id === id); const list = messages[id];
  const isRequest = requests.some((c) => c.conversation_id === id);
  useEffect(() => { open(id); return close; }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [list?.length]);

  if (!list) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (!row) return <EmptyState title="Conversation unavailable" action={<Button onClick={() => nav('/messages')}>Back to messages</Button>} />;
  return (
    <div className="ft-card flex h-[calc(100dvh-var(--layout-topbarH)-var(--layout-bottomNavH)-var(--space-8))] flex-col overflow-hidden md:h-[calc(100dvh-var(--layout-topbarH)-var(--space-8))]">
      <header className="flex items-center gap-3 border-b border-border p-3">
        <Button variant="ghost" size="sm" aria-label="Back" onClick={() => nav('/messages')}><ArrowLeft size={20} /></Button>
        <Link to={`/u/${row.other_username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={row.other_name} src={row.other_avatar} size="sm" /><span className="truncate font-semibold">{row.other_name}</span></Link>
        <UserMenu userId={row.other_user_id} name={row.other_name} conversationId={id} onBlocked={() => nav('/messages')} />
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {!list.length && <p className="text-center text-muted">Say hello in the language you're practicing.</p>}
        {list.map((m) => <MessageBubble key={m.id} message={m} mine={m.sender_id === myId} myId={myId!} corrections={corrections[m.id] ?? []} reactions={reactions[m.id] ?? []} otherName={row.other_name} translateTo={translateTo}
          onCorrect={setCorrecting} onSave={(msg, translation) => savePhrase({ phrase: msg.body, translation, sourceMessageId: msg.id })} onReact={(msg, emoji) => react(msg.id, emoji)} onAccept={accept} onDismiss={dismiss} />)}
        <div ref={endRef} />
      </div>
      {isRequest ? (
        <div className="space-y-2 border-t border-border p-4">
          <p className="text-sm text-muted">{row.other_name} isn't in your followers yet. Accept to reply, or ignore this request.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => respond(id, true)}>Accept</Button>
            <Button size="sm" variant="secondary" onClick={async () => { await respond(id, false); nav('/messages'); }}>Ignore</Button>
            <Button size="sm" variant="danger" onClick={async () => { await blockUser(row.other_user_id); nav('/messages'); }}>Block</Button>
          </div>
        </div>) : <Composer onSend={(t) => send(id, t)} />}
      <CorrectionDialog message={correcting} onClose={() => setCorrecting(null)} onSubmit={async (t, n) => { await suggest(id, correcting!.id, t, n || undefined); setCorrecting(null); }} />
    </div>
  );
}
