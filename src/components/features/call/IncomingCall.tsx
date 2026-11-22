// The incoming-call banner (mounted once, in AppShell) and the call button for a chat. Neither loads the media SDK.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Trash2, Video } from 'lucide-react';
import { Avatar, Button, ConfirmDialog } from '@/components/ui';
import { HangUpIcon } from './CallParts';
import { useMessageGestures } from '@/hooks/useMessageGestures';
import { callControl, hideCall, listLiveCalls, reportCallRinging, respondCallInvite, subscribeToMyCalls, type CallLogRow, type LiveCall } from '@/services/calls';
import { endedText, formatDuration } from '@/lib/callState';
import { userMessage } from '@/lib/errors';
import { ring } from '@/lib/ringtone';

export function IncomingCallBanner() {
  const nav = useNavigate(); const { pathname } = useLocation();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  useEffect(() => {
    let on = true;
    const load = () => { listLiveCalls().then((r) => { if (on) setCalls(r); }).catch(() => undefined); };
    load();
    const off = subscribeToMyCalls(load);
    // A safety net if a live update is missed: often while the tab is open, and again whenever it comes back.
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15_000);
    const back = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', back); window.addEventListener('focus', back);
    return () => { on = false; off(); clearInterval(t); document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back); };
  }, []);
  const ringing = calls.find((c) => c.my_invitation === 'pending' && c.status === 'ringing' && Date.parse(c.ring_expires_at) > now);
  const stillIn = calls.find((c) => c.my_invitation === 'accepted' && c.status === 'active');
  const shown = ringing ?? stillIn;
  useEffect(() => { if (!shown) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [shown]);
  // A background tab shows it in its title, since a banner can't be seen there.
  useEffect(() => {
    if (!ringing) return;
    const before = document.title; document.title = `Incoming call from ${ringing.other_name ?? 'a partner'}`;
    return () => { document.title = before; };
  }, [ringing?.call_id]);
  // It rings until it's answered, declined or runs out. The call screen rings on its own, so not there.
  const ringsHere = !!ringing && !pathname.startsWith('/call/');
  useEffect(() => (ringsHere ? ring('incoming') : undefined), [ringsHere, ringing?.call_id]);
  // Tell the caller it's ringing here, once per call.
  const told = useRef(new Set<string>());
  useEffect(() => {
    const cid = ringing?.call_id; if (!cid || told.current.has(cid)) return;
    told.current.add(cid); reportCallRinging(cid).catch(() => undefined);
  }, [ringing?.call_id]);
  const [busy, setBusy] = useState(false);

  if (!shown || pathname.startsWith('/call/')) return null;
  const name = shown.other_name || shown.other_username || 'Your partner';
  // Answer goes straight into the call, camera and microphone on; Rejoin opens the screen first.
  const open = (answer: boolean) => nav(`/call/${shown.call_id}`, { state: { name, avatar: shown.other_avatar, answer } });
  const decline = () => { setBusy(true); setError(''); return respondCallInvite(shown.call_id, false).then(() => setCalls((c) => c.filter((x) => x.call_id !== shown.call_id))).catch((e) => setError(userMessage(e))).finally(() => setBusy(false)); };
  const hangUp = () => callControl(shown.call_id, 'leave').then(() => setCalls((c) => c.filter((x) => x.call_id !== shown.call_id))).catch((e) => setError(userMessage(e)));
  if (ringing) {
    const left = Math.max(0, Math.ceil((Date.parse(ringing.ring_expires_at) - now) / 1000));
    // A ringing call covers whatever page is open, like a phone's call screen.
    return createPortal(
      <div role="alertdialog" aria-modal="true" aria-live="assertive" aria-label={`${name} is calling you`}
        className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-deep px-6 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-[calc(env(safe-area-inset-top,0px)+4rem)] text-center text-on-deep">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm uppercase tracking-widest text-on-deep/75">Incoming video call</p>
          <span className="relative inline-flex">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-go/40" />
            <span className="relative rounded-full shadow-[0_0_0_6px_rgb(var(--c-go)/0.5)]"><Avatar name={name} src={shown.other_avatar} size="xl" /></span>
          </span>
          <h2 className="font-display text-3xl text-on-deep">{name}</h2>
          <p className="text-sm text-on-deep/80">is calling you… <span className="tabular-nums">{left}s</span></p>
          {error && <p role="alert" className="rounded-md bg-danger/20 px-3 py-2 text-sm">{error}</p>}
        </div>
        <div className="flex w-full max-w-xs items-start justify-between">
          <RoundAction label={`Decline the call from ${name}`} caption="Decline" tone="end" disabled={busy} onClick={() => void decline()}><HangUpIcon size={28} /></RoundAction>
          <RoundAction label={`Answer the call from ${name}`} caption="Answer" tone="go" disabled={busy} onClick={() => open(true)}><Video size={28} /></RoundAction>
        </div>
      </div>, document.body);
  }
  return (
    <div role="alertdialog" aria-live="assertive" aria-label={`You're still in a call with ${name}`}
      className="fixed inset-x-2 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[55] mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-md bg-deep p-3 text-on-deep shadow-lg">
      <Avatar name={name} src={shown.other_avatar} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-on-deep/80">You left the call screen. The call is still open.</p>
        {error && <p role="alert" className="text-xs">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="danger" className="bg-danger text-on-brand" onClick={() => void hangUp()}><HangUpIcon size={16} />Hang up</Button>
        <Button size="sm" className="border-go bg-go text-on-brand" onClick={() => open(false)}><Phone size={16} />Rejoin</Button>
      </div>
    </div>
  );
}

function RoundAction({ label, caption, tone, disabled, onClick, children }: { label: string; caption: string; tone: 'go' | 'end'; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
        className={`inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-on-brand shadow-pop transition hover:brightness-110 disabled:opacity-50 ${tone === 'go' ? 'bg-go' : 'bg-danger'}`}>
        {children}
      </button>
      <span aria-hidden className="text-sm">{caption}</span>
    </div>);
}

/** Starts the device preview for a call to this person. The server decides whether they can be called. */
export function CallButton({ userId, name, avatar }: { userId: string; name: string; avatar?: string | null }) {
  const nav = useNavigate();
  return (
    <Button variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label={`Video call ${name}`} title="Video call"
      onClick={() => nav(`/call/new?to=${userId}`, { state: { name, avatar } })}>
      <Video size={19} />
    </Button>
  );
}

/** One finished call, shown in the chat between the two people. Tapping it calls them again. */
export function CallLogEntry({ row, myId, userId, name, avatar, onHidden }: { row: CallLogRow; myId: string | undefined; userId: string; name: string; avatar?: string | null; onHidden?: (callId: string) => void }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  // Like a message: a long press (or right click) offers to delete it. The bin button does the same.
  useMessageGestures(rowRef, { onSwipeRight: () => undefined, onLongPress: () => setConfirm(true) });
  const missed = !row.outgoing && !row.attended;
  const text = endedText({ status: row.status, end_reason: row.end_reason, started_at: row.started_at, ended_at: row.ended_at, initiated_by: row.outgoing ? myId ?? null : null }, myId, name);
  const length = row.attended && row.started_at && row.ended_at ? formatDuration((Date.parse(row.ended_at) - Date.parse(row.started_at)) / 1000) : '';
  const Icon = missed ? PhoneMissed : row.outgoing ? PhoneOutgoing : PhoneIncoming;
  const title = row.attended ? (row.outgoing ? 'Outgoing video call' : 'Incoming video call') : text.title;
  const at = new Date(row.ended_at ?? row.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div ref={rowRef} className="group my-2 flex items-center justify-center gap-1" onContextMenu={(e) => { e.preventDefault(); setConfirm(true); }}>
      <button type="button" onClick={() => nav(`/call/new?to=${userId}`, { state: { name, avatar } })} aria-label={`${title}${length ? `, ${length}` : ''}, ${at}. Call ${name} again`}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs hover:bg-surface-2 ${missed ? 'border-danger/40 text-danger' : 'border-border text-muted'}`}>
        <Icon size={14} aria-hidden />
        <span className="font-semibold">{title}</span>
        {length && <span>· {length}</span>}
        <span>· {at}</span>
      </button>
      <button type="button" onClick={() => setConfirm(true)} aria-label={`Delete this call from your chat`} title="Delete for me"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted opacity-60 transition hover:bg-surface-2 hover:text-danger hover:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100">
        <Trash2 size={14} aria-hidden />
      </button>
      <DeleteCallDialog open={confirm} callId={row.call_id} name={name} onClose={() => setConfirm(false)} onHidden={(id) => onHidden?.(id)} />
    </div>);
}

/** Deleting a call only takes it off my screen: it's shared with the other person and kept for their history. */
export function DeleteCallDialog({ open, callId, name, onClose, onHidden }: { open: boolean; callId: string; name: string; onClose: () => void; onHidden: (callId: string) => void }) {
  return (
    <ConfirmDialog open={open} title="Delete this call for you?" confirmLabel="Delete" danger onClose={onClose}
      onConfirm={async () => { await hideCall(callId); onHidden(callId); }}>
      It disappears from your chat and your call history. {name} still sees it.
    </ConfirmDialog>);
}
