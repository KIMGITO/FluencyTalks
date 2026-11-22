// What every person row and profile shares: connect, call, and whether they're around right now.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock, PhoneCall, ThumbsUp, UserPlus, Video, X } from 'lucide-react';
import { compactBtn, compactLabel } from '../ActionButtonStyle';
import { Avatar, Button, Card, ConfirmDialog } from '@/components/ui';
import { LanguageChip, languageEntry } from '../LanguageChip';
import { CountryBadge } from '../CountryBadge';
import { removeConnection, requestConnection, respondConnection, type PersonStatus } from '@/services/connections';
import { userMessage } from '@/lib/errors';
import { toast } from '@/store/toastStore';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import type { Person } from '@/types/db';

type Patch = (id: string, p: Partial<PersonStatus>) => void;

/** Online, on a call, or nothing. "On a call" is only known for people you may call. */
export function PresenceLine({ status }: { status?: PersonStatus }) {
  if (!status) return null;
  if (status.in_call) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning"><PhoneCall size={12} aria-hidden />On a call</span>;
  if (status.online) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-go"><span aria-hidden className="h-2 w-2 rounded-full bg-go" />Online</span>;
  return null;
}

export function GoodCalls({ count }: { count?: number }) {
  if (!count) return null;
  return <span className="inline-flex items-center gap-1 text-xs text-muted"><ThumbsUp size={12} aria-hidden />{count} good {count === 1 ? 'call' : 'calls'}</span>;
}

/** Connect, cancel, accept or decline, or end a connection, depending on where the two of you stand. */
export function ConnectButton({ userId, name, status, onChange, size = 'sm', compact }: { userId: string; name: string; status?: PersonStatus; onChange: Patch; size?: 'sm' | 'md'; compact?: boolean }) {
  const cls = compact ? compactBtn : undefined;
  const label = (text: string) => compact ? <span className={compactLabel}>{text}</span> : text;
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(userMessage(e)); } finally { setBusy(false); } };
  const state = status?.connection ?? 'none';
  if (!status) return null;
  if (state === 'incoming') {
    return (
      <span className="inline-flex gap-1.5">
        <Button size={size} loading={busy} onClick={() => void run(async () => { await respondConnection(userId, true); onChange(userId, { connection: 'connected', can_call: true }); })} className={cls} title="Accept"><Check size={15} aria-hidden />{label('Accept')}</Button>
        <Button size={size} variant="secondary" disabled={busy} className={cls} aria-label={`Decline ${name}'s request`} onClick={() => void run(async () => { await respondConnection(userId, false); onChange(userId, { connection: 'none' }); })}><X size={15} aria-hidden /></Button>
      </span>);
  }
  // Partners: nothing to show here. Message and Learn together take its place; removing a partner lives in the ⋮ menu.
  if (state === 'connected') return null;
  if (state === 'outgoing') {
    return <Button size={size} variant="secondary" loading={busy} className={cls} title="Requested · tap to cancel" onClick={() => void run(async () => { await removeConnection(userId); onChange(userId, { connection: 'none' }); })}>{compact && !busy && <Clock size={15} aria-hidden />}{label('Requested')}</Button>;
  }
  return (
    <Button size={size} loading={busy} className={cls} title="Add partner" onClick={() => void run(async () => {
      const r = await requestConnection(userId);
      onChange(userId, r === 'connected' ? { connection: 'connected', can_call: true } : { connection: 'outgoing' });
    })}>{!(compact && busy) && <UserPlus size={15} aria-hidden />}{label('Add partner')}</Button>);
}

/** Confirm ending a partnership. Opened from the profile's ⋮ menu. */
export function DisconnectDialog({ open, userId, name, onClose, onChange }: { open: boolean; userId: string; name: string; onClose: () => void; onChange: Patch }) {
  return (
    <ConfirmDialog open={open} title={`Remove ${name} as a partner?`} confirmLabel="Remove partner" danger onClose={onClose}
      onConfirm={async () => { await removeConnection(userId); onChange(userId, { connection: 'none', can_call: false, in_call: false }); onClose(); }}>
      <p className="text-sm text-ink">You can still message each other if you have a chat. To call again without one, you'd need to become partners again.</p>
    </ConfirmDialog>);
}

/** Call a partner or someone you're chatting with. Says so when they're already on a call. */
export function CallPersonButton({ person, status, size = 'sm', compact }: { person: { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null }; status?: PersonStatus; size?: 'sm' | 'md'; compact?: boolean }) {
  const nav = useNavigate();
  if (!status?.can_call) return null;
  const name = person.display_name || person.username;
  return (
    <Button size={size} variant={status.in_call ? 'secondary' : 'primary'} disabled={status.in_call} className={compact ? compactBtn : undefined} title={status.in_call ? `${name} is on a call` : `Call ${name}`}
      onClick={() => nav(`/call/new?to=${person.id}`, { state: { name, avatar: person.avatar_url } })}>
      {status.in_call ? <PhoneCall size={15} aria-hidden /> : <Video size={15} aria-hidden />}
      {compact ? <span className={compactLabel}>{status.in_call ? 'On a call' : 'Learn together'}</span> : status.in_call ? 'On a call' : 'Learn together'}
    </Button>);
}

/** One person in the People tab: who they are, whether they're around, and add as partner or call. */
export function PersonCard({ person, status, onChange }: { person: Person; status?: PersonStatus; onChange: Patch }) {
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Link to={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.display_name} src={person.avatar_url} size="lg" ring online={!!status?.online} busy={!!status?.in_call} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{person.display_name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            <span className="truncate">@{person.username}</span>
            <CountryBadge code={person.country_code} timezone={person.timezone} />
            <PresenceLine status={status} />
            <GoodCalls count={status?.good_calls} />
          </span>
          {!!person.languages.length && <span className="ft-chips mt-1.5"><LanguageChip languages={person.languages.map((l) => languageEntry(l, labelOf(l, locales)))} /></span>}
          {person.bio && <span className="mt-1 line-clamp-2 block text-sm text-ink">{person.bio}</span>}
        </span>
      </Link>
      <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col sm:items-end">
        <ConnectButton userId={person.id} name={person.display_name} status={status} onChange={onChange} />
        {status?.connection === 'connected' && <CallPersonButton person={person} status={status} />}
      </div>
    </Card>
  );
}
