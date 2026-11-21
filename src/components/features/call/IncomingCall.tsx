// The incoming-call banner (mounted once, in AppShell) and the call button for a chat. Neither loads the media SDK.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { callControl, listLiveCalls, respondCallInvite, subscribeToMyCalls, type LiveCall } from '@/services/calls';
import { userMessage } from '@/lib/errors';

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
    const t = setInterval(load, 30_000);   // a safety net if a live update is missed
    return () => { on = false; off(); clearInterval(t); };
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

  if (!shown || pathname.startsWith('/call/')) return null;
  const name = shown.other_name || shown.other_username || 'Your partner';
  const open = () => nav(`/call/${shown.call_id}`, { state: { name, avatar: shown.other_avatar } });
  const decline = () => respondCallInvite(shown.call_id, false).then(() => setCalls((c) => c.filter((x) => x.call_id !== shown.call_id))).catch((e) => setError(userMessage(e)));
  const hangUp = () => callControl(shown.call_id, 'leave').then(() => setCalls((c) => c.filter((x) => x.call_id !== shown.call_id))).catch((e) => setError(userMessage(e)));
  return (
    <div role="alertdialog" aria-live="assertive" aria-label={ringing ? `${name} is calling you` : `You're still in a call with ${name}`}
      className="fixed inset-x-2 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[55] mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-md bg-deep p-3 text-on-deep shadow-lg">
      <Avatar name={name} src={shown.other_avatar} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-on-deep/80">{ringing ? 'Video call' : 'You left the call screen. The call is still open.'}</p>
        {error && <p role="alert" className="text-xs">{error}</p>}
      </div>
      <div className="flex gap-2">
        {ringing
          ? <><Button size="sm" variant="danger" className="bg-danger text-on-brand" onClick={() => void decline()} aria-label={`Decline the call from ${name}`}><PhoneOff size={16} />Decline</Button>
              <Button size="sm" onClick={open} aria-label={`Answer the call from ${name}`}><Phone size={16} />Answer</Button></>
          : <><Button size="sm" variant="danger" className="bg-danger text-on-brand" onClick={() => void hangUp()}><PhoneOff size={16} />Hang up</Button>
              <Button size="sm" onClick={open}>Rejoin</Button></>}
      </div>
    </div>
  );
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
