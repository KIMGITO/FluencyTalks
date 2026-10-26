import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, Input, Spinner, Tabs, Textarea } from '@/components/ui';
import { answerBounty, listMyBounties, listOpenBounties, type MyBounty, type OpenBounty } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

type Tab = 'open' | 'mine';

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h}h left` : `${Math.max(1, Math.floor(ms / 60_000))}m left`;
};


export default function BountyQueue() {
  const [tab, setTab] = useState<Tab>('open');
  const [open, setOpen] = useState<OpenBounty[] | null>(null);
  const [mine, setMine] = useState<MyBounty[] | null>(null);
  const [error, setError] = useState('');
  const myId = useAuthStore((s) => s.user?.id);
  const loadProfile = useProfileStore((s) => s.load);
  const nameOf = useLanguageStore((s) => s.name);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [o, m] = await Promise.all([listOpenBounties(), listMyBounties()]);
      setOpen(o); setMine(m);
      if (myId) await loadProfile(myId);          
    } catch (e) { setError((e as Error).message); setOpen((v) => v ?? []); setMine((v) => v ?? []); }
  }, [myId, loadProfile]);
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PageHeader title="Bounties" subtitle="Help others with their writing and earn points, or ask the community for help" />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Tabs<Tab> value={tab} onChange={setTab} items={[{ key: 'open', label: 'I can answer' }, { key: 'mine', label: 'My bounties' }]} />
        <Link to="/points-history" className="text-sm text-brand">Points history</Link>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {tab === 'open'
        ? (open === null ? <div className="flex justify-center p-8"><Spinner /></div>
          : !open.length ? <EmptyState title="No open bounties" text="Bounties in a language you speak natively, or know at B1 or above, show up here." />
          : <div className="space-y-3">{open.map((b) => <OpenCard key={b.message_id} bounty={b} language={nameOf(b.language_id)} />)}</div>)
        : (mine === null ? <div className="flex justify-center p-8"><Spinner /></div>
          : !mine.length ? <EmptyState title="No bounties yet" text="In a chat, tick “Ask the community” before sending a message. It costs 50 points, refunded if nobody helps within 48 hours." />
          : <div className="space-y-3">{mine.map((b) => <MineCard key={b.message_id} bounty={b} language={b.language_id ? nameOf(b.language_id) : ''} />)}</div>)}
    </div>
  );
}

function OpenCard({ bounty, language }: { bounty: OpenBounty; language: string }) {
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState(bounty.body);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true); setError('');
    try { await answerBounty(bounty.message_id, text, note); setSent(true); }   // the card stays, so the confirmation stays visible
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const name = bounty.asker_display_name ?? bounty.asker_username ?? 'Someone';
  return (
    <div className="ft-card space-y-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <Avatar name={name} src={bounty.asker_avatar_url} size="xs" />
        <span className="font-semibold">{name}</span>
        <span className="text-muted">· {language} · {timeLeft(bounty.expires_at)}</span>
        <span className="ml-auto font-semibold text-brand">{bounty.cost} pts</span>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-surface-2 p-2">{bounty.body}</p>
      {sent ? <p className="text-success">Sent. If {name} accepts your correction, you earn {bounty.cost} points.</p>
        : !answering ? <Button size="sm" onClick={() => setAnswering(true)}>Answer</Button>
        : (
          <div className="space-y-2">
            <Textarea label="Your corrected version" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
            <Input label="Why? (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            {error && <p className="text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" loading={busy} disabled={!text.trim() || text.trim() === bounty.body.trim()} onClick={send}>Send correction</Button>
              <Button size="sm" variant="ghost" onClick={() => setAnswering(false)}>Cancel</Button>
            </div>
          </div>
        )}
    </div>
  );
}

function MineCard({ bounty, language }: { bounty: MyBounty; language: string }) {
  const status = { open: `Open · ${timeLeft(bounty.expires_at)}`, paid: 'Answered and paid', refunded: 'Refunded' }[bounty.status];
  return (
    <div className="ft-card space-y-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{status}</span>
        {language && <span className="text-muted">· {language}</span>}
        <span className="ml-auto font-semibold text-brand">{bounty.cost} pts</span>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-surface-2 p-2">{bounty.body}</p>
      <div className="flex items-center justify-between text-muted">
        <span>{bounty.status === 'open' ? `${bounty.answers} answer${bounty.answers === 1 ? '' : 's'} waiting for you` : ''}</span>
        <Link to={`/messages/${bounty.conversation_id}`} className="text-brand">Open chat</Link>
      </div>
    </div>
  );
}
