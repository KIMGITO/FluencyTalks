// Your calls: who, when, how long, and how each ended. Only calls you were part of (the database decides).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Trash2, Video } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { listCallHistory, type CallHistoryRow } from '@/services/calls';
import { endedText } from '@/lib/callState';
import { DeleteCallDialog } from '@/components/features/call/IncomingCall';
import { useAuthStore } from '@/store/authStore';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function CallHistory() {
  const myId = useAuthStore((s) => s.user?.id); const nav = useNavigate();
  const [rows, setRows] = useState<CallHistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<CallHistoryRow | null>(null);
  const load = () => { setFailed(false); listCallHistory(50).then(setRows).catch(() => setFailed(true)); };
  useEffect(load, []);

  return (
    <>
      <PageHeader title="Calls" />
      {failed ? <ErrorState title="Couldn't load your calls" onRetry={load} />
        : !rows ? <div className="ft-inset space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : !rows.length ? <EmptyState title="No calls yet" action={<Link to="/messages" className="underline">Open a chat to start one</Link>} />
            : (
              <ul className="ft-inset divide-y divide-border rounded-md border border-border bg-surface">
                {rows.map((r) => {
                  const missed = !r.outgoing && !r.attended;
                  const name = r.other_name || r.other_username || 'Former member';
                  const text = endedText({ status: r.status, end_reason: r.end_reason, started_at: r.started_at, ended_at: r.ended_at, initiated_by: r.outgoing ? myId ?? null : null }, myId, name);
                  const Icon = missed ? PhoneMissed : r.outgoing ? PhoneOutgoing : PhoneIncoming;
                  return (
                    <li key={r.call_id} className="flex items-center gap-3 p-3">
                      <Avatar name={name} src={r.other_avatar} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{name}</p>
                        <p className={missed ? 'flex items-center gap-1.5 text-sm text-danger' : 'flex items-center gap-1.5 text-sm text-muted'}>
                          <Icon size={14} aria-hidden />
                          <span>{r.status === 'ringing' || r.status === 'active' ? 'In progress' : text.title}{text.detail && r.attended ? ` · ${text.detail.replace(/^It lasted /, '').replace(/\.$/, '')}` : ''}</span>
                        </p>
                        <p className="text-xs text-muted"><time dateTime={r.created_at}>{when(r.created_at)}</time></p>
                      </div>
                      {r.other_id && (
                        <Button size="sm" variant="ghost" className="h-10 w-10 px-0" aria-label={`Video call ${name}`}
                          onClick={() => nav(`/call/new?to=${r.other_id}`, { state: { name, avatar: r.other_avatar } })}>
                          <Video size={18} />
                        </Button>)}
                      {r.status !== 'ringing' && r.status !== 'active' && (
                        <Button size="sm" variant="ghost" className="h-10 w-10 px-0 text-muted hover:text-danger" aria-label={`Delete this call with ${name}`} title="Delete for me" onClick={() => setDeleting(r)}>
                          <Trash2 size={17} />
                        </Button>)}
                    </li>);
                })}
              </ul>)}
      <DeleteCallDialog open={!!deleting} callId={deleting?.call_id ?? ''} name={deleting?.other_name || deleting?.other_username || 'The other person'}
        onClose={() => setDeleting(null)} onHidden={(cid) => setRows((rs) => rs?.filter((x) => x.call_id !== cid) ?? null)} />
    </>
  );
}
