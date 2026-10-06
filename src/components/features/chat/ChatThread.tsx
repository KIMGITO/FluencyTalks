import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pin, X } from 'lucide-react';
import { Avatar, Button, EmptyState, Spinner } from '@/components/ui';
import { UserMenu } from '../UserMenu';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { CorrectionDialog } from './CorrectionDialog';
import { blockUser, getPeerReadAt, savePhrase, saveTranslation, subscribeToReceipts } from '@/services';
import { groupByDay, isClusterStart } from '@/lib/chatGroups';
import type { Message } from '@/types/db';
import type { TickState } from './MessageBubble';
import { useAuthStore } from '@/store/authStore';
import { isGone, useChatStore } from '@/store/chatStore';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { usePresence } from '@/hooks/usePresence';

export function ChatThread({ id }: { id: string }) {
  const nav = useNavigate(); const myId = useAuthStore((s) => s.user?.id);
  const { open, close, messages, corrections, reactions, active, requests, send, respond, suggest, accept, dismiss, react, pins, hidden, drafts, togglePin, hideForMe, deleteForEveryone, setReply } = useChatStore(); const endRef = useRef<HTMLDivElement>(null);
  const [correcting, setCorrecting] = useState<Message | null>(null);
  const [showPins, setShowPins] = useState(false);
  // ISO 639-3 id of the language I want translations in; 'eng' when no native language is set.
  const translateTo = useProfileStore((s) => s.languages.find((l) => l.role === 'native')?.language_id ?? 'eng');
  const providerOf = useLanguageStore((s) => s.provider);
  const translateApi = providerOf(translateTo);   // the same language as the translation API names it
  const row = [...active, ...requests].find((c) => c.conversation_id === id); const list = messages[id];
  const isRequest = requests.some((c) => c.conversation_id === id);
  const peerId = row?.other_user_id ?? null;
  const { onlineIds, peerTyping, touchTyping } = usePresence(list ? id : null, peerId, myId ?? null);
  const peerOnline = peerId ? onlineIds.includes(peerId) : false;
  // Peer read receipt: my messages at or before this timestamp have been read.
  // Loaded on open, then kept live via the conversation_members realtime channel.
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  useEffect(() => { setPeerReadAt(null); getPeerReadAt(id).then(setPeerReadAt).catch(() => undefined); }, [id]);
  useEffect(() => subscribeToReceipts(id, setPeerReadAt), [id]);
  useEffect(() => { open(id); return close; }, [id]);
  const visible = (list ?? []).filter((m) => !hidden[m.id] && !isGone(m));
  /** My message state: read when the peer opened the chat past it, delivered when
   *  they're online (or anyone replied after it), sent otherwise. */
  const tickFor = (m: Message): TickState => {
    if (peerReadAt && m.created_at <= peerReadAt) return 'read';
    if (peerOnline) return 'delivered';
    const laterPeer = visible.some((x) => x.sender_id !== myId && x.created_at > m.created_at);
    return laterPeer ? 'delivered' : 'sent';
  };
  const byId = new Map(visible.map((m) => [m.id, m]));
  const pinnedIds = pins[id] ?? [];
  const pinnedMsgs = pinnedIds.map((pid) => byId.get(pid)).filter((m): m is Message => !!m && !isGone(m));
  const rawReply = drafts[id] ?? null;
  const replyTarget = rawReply && isGone(rawReply) ? null : rawReply;
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [visible.length, replyTarget?.id, peerTyping]);

  if (!list) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (!row) return <EmptyState title="Conversation unavailable" action={<Button onClick={() => nav('/messages')}>Back to messages</Button>} />;
  const days = groupByDay(visible);
  const jumpTo = (mid: string) => { setShowPins(false); document.getElementById(`msg-${mid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  return (
    <div className="ft-thread-shell">
      <header className="flex items-center gap-2 border-b border-border bg-surface p-2.5 md:p-3">
        <Button variant="ghost" size="sm" aria-label="Back" onClick={() => nav('/messages')}><ArrowLeft size={20} /></Button>
        <Link to={`/u/${row.other_username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={row.other_name} src={row.other_avatar} size="sm" online={peerOnline} />
          <span className="min-w-0">
            <span className="block truncate font-semibold leading-tight">{row.other_name}</span>
            <span className="block text-2xs leading-tight text-muted" aria-live="polite">{peerTyping ? 'typing…' : peerOnline ? 'Online' : 'Offline'}</span>
          </span>
        </Link>
        {!!pinnedMsgs.length && (
          <Button variant="ghost" size="sm" aria-label={`Pinned messages (${pinnedMsgs.length})`} onClick={() => setShowPins((v) => !v)}><Pin size={17} className="text-brand" /></Button>)}
        <UserMenu userId={row.other_user_id} name={row.other_name} conversationId={id} onBlocked={() => nav('/messages')} />
      </header>
      {!!pinnedMsgs.length && (
        <button onClick={() => setShowPins((v) => !v)} className="flex items-center gap-2 truncate border-b border-border bg-brand-soft px-3 py-1.5 text-left text-xs text-brand">
          <Pin size={13} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{pinnedMsgs.length === 1 ? pinnedMsgs[0].body : `${pinnedMsgs.length} pinned messages`}</span>
        </button>)}
      {showPins && !!pinnedMsgs.length && (
        <div className="max-h-44 space-y-1.5 overflow-y-auto border-b border-border bg-surface p-2.5" role="list" aria-label="Pinned messages">
          {pinnedMsgs.map((m) => (
            <div key={m.id} role="listitem" className="flex cursor-pointer items-center gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs hover:bg-brand-soft" onClick={() => jumpTo(m.id)}>
              <Pin size={12} className="shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate">{m.body}</span>
              <span aria-label="Unpin" role="button" tabIndex={0} className="shrink-0 rounded-full p-1 text-muted hover:text-danger"
                onClick={(e) => { e.stopPropagation(); togglePin(id, m.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(id, m.id); } }}><X size={13} /></span>
            </div>))}
        </div>)}
      <div className="ft-thread" role="log" aria-label={`Conversation with ${row.other_name}`}>
        {!visible.length && <p className="py-6 text-center text-sm text-muted">Say hello in the language you're practicing.</p>}
        {days.map((day) => (
          <section key={day.key} aria-label={day.label}>
            <div className="ft-daybadge my-2">{day.label}</div>
            {day.messages.map((m, i) => (
              <div key={m.id} id={`msg-${m.id}`}>
                <MessageBubble message={m} mine={m.sender_id === myId} myId={myId!} corrections={corrections[m.id] ?? []} reactions={reactions[m.id] ?? []} otherName={row.other_name}
                  pinned={pinnedIds.includes(m.id)} showTail={isClusterStart(i === 0 ? undefined : day.messages[i - 1], m)} replyTo={m.reply_to ? byId.get(m.reply_to) ?? null : null}
                  tick={m.sender_id === myId ? tickFor(m) : undefined}
                  translateTo={translateTo} translateApi={translateApi}
                  onCorrect={setCorrecting} onSave={(msg, translation) => savePhrase({ phrase: msg.body, translation, sourceMessageId: msg.id })} onReact={(msg, emoji) => react(msg.id, emoji)} onAccept={accept} onDismiss={dismiss}
                  onReply={(msg) => setReply(id, msg)} onPin={(msg) => togglePin(id, msg.id)}
                  onDeleteMe={(msg) => hideForMe(msg.id)} onDeleteAll={(msg) => deleteForEveryone(id, msg.id)}
                  onTranslated={(msg, out, lang) => { saveTranslation({ source: msg.body, translated: out, languageCode: lang, sourceMessageId: msg.id }).catch(() => undefined); }} />
              </div>))}
          </section>))}
        <div ref={endRef} />
      </div>
      {peerTyping && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center" aria-live="polite">
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-2xs font-semibold text-muted shadow-pop">
            <span className="flex gap-0.5"><span className="ft-typing-dot" /><span className="ft-typing-dot" style={{ animationDelay: '.2s' }} /><span className="ft-typing-dot" style={{ animationDelay: '.4s' }} /></span>
            {row.other_name.split(' ')[0]} is typing
          </span>
        </div>)}
      {isRequest ? (
        <div className="space-y-2 border-t border-border bg-surface p-3">
          <p className="text-sm text-muted">{row.other_name} isn't in your followers yet. Accept to reply, or ignore this request.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => respond(id, true)}>Accept</Button>
            <Button size="sm" variant="secondary" onClick={async () => { await respond(id, false); nav('/messages'); }}>Ignore</Button>
            <Button size="sm" variant="danger" onClick={async () => { await blockUser(row.other_user_id); nav('/messages'); }}>Block</Button>
          </div>
        </div>) : <Composer onSend={(t) => send(id, t)} replyTo={replyTarget} onCancelReply={() => setReply(id, null)} onType={touchTyping} />}
      <CorrectionDialog message={correcting} onClose={() => setCorrecting(null)} onSubmit={async (t, n) => { await suggest(id, correcting!.id, t, n || undefined); setCorrecting(null); }} />
    </div>
  );
}
