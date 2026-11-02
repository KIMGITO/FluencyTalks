import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, EmptyState, ErrorState, Input, RowListSkeleton, Tabs, Textarea } from '@/components/ui';
import { DiffText } from '@/components/features/chat/DiffText';
import { answerBounty, BOUNTY_PAGE, listMyBounties, listMyBountyAnswers, listOpenBounties, type MyBounty, type MyBountyAnswer, type OpenBounty } from '@/services';
import { qualifiedLanguages } from '@/lib/corrections';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

type Tab = 'open' | 'answers' | 'mine';
const TABS: { key: Tab; label: string }[] = [{ key: 'open', label: 'I can answer' }, { key: 'answers', label: 'My answers' }, { key: 'mine', label: 'My bounties' }];
/** Bounties are created and decided in other people's chats: look again when you come back, and every minute. */
const REFRESH_MS = 60_000;

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h}h left` : `${Math.max(1, Math.floor(ms / 60_000))}m left`;
};
const Pill = ({ tone, children }: { tone: 'open' | 'good' | 'bad' | 'muted'; children: ReactNode }) => (
  <span className={clsx('rounded-sm px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide',
    { open: 'bg-brand-soft text-ink', good: 'bg-success/15 text-success', bad: 'bg-danger/10 text-danger', muted: 'bg-surface-2 text-muted' }[tone])}>{children}</span>
);

export default function BountyQueue() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'open') as Tab;
  const setTab = (t: Tab) => setParams(t === 'open' ? {} : { tab: t }, { replace: true });
  const [open, setOpen] = useState<OpenBounty[] | null>(null);
  const [more, setMore] = useState<'idle' | 'loading' | 'done'>('idle');
  const [answers, setAnswers] = useState<MyBountyAnswer[] | null>(null);
  const [mine, setMine] = useState<MyBounty[] | null>(null);
  const [error, setError] = useState('');
  const myId = useAuthStore((s) => s.user?.id);
  const me = useProfileStore((s) => s.me);
  const loadProfile = useProfileStore((s) => s.load);
  const nameOf = useLanguageStore((s) => s.name);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [o, a, m] = await Promise.all([listOpenBounties(0), listMyBountyAnswers(), listMyBounties()]);
      setOpen(o); setAnswers(a); setMine(m); setMore(o.length < BOUNTY_PAGE ? 'done' : 'idle');
      if (myId) await loadProfile(myId);   // refunds and rewards change the balance
    } catch (e) { setError((e as Error).message); }
  }, [myId, loadProfile]);
  useEffect(() => {
    void refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    const t = setInterval(onFocus, REFRESH_MS);
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(t); };
  }, [refresh]);
  const loadMore = async () => {
    if (!open || more !== 'idle') return;
    setMore('loading');
    try {
      const next = await listOpenBounties(open.length);
      setOpen((cur) => [...(cur ?? []), ...next.filter((n) => !cur?.some((c) => c.message_id === n.message_id))]);
      setMore(next.length < BOUNTY_PAGE ? 'done' : 'idle');
    } catch (e) { setError((e as Error).message); setMore('idle'); }
  };
  const canAnswerIn = qualifiedLanguages(me).map(nameOf).join(' or ');
  const pendingAnswers = answers?.filter((a) => a.status === 'pending').length ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Bounties" subtitle="Help others with their writing and earn points, or ask the community for help" />
      <div className="ft-inset mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs<Tab> value={tab} onChange={setTab} items={TABS.map((t) => (t.key === 'answers' && pendingAnswers ? { ...t, label: `${t.label} (${pendingAnswers})` } : t))} />
        <Link to="/points-history" className="text-sm text-brand">Points history</Link>
      </div>
      {error && open !== null && <p className="ft-inset mb-3 text-sm text-danger">{error}</p>}
      {error && (open === null || mine === null || answers === null) ? <ErrorState title="Couldn't load bounties" onRetry={() => void refresh()} />
        : tab === 'open' ? (
          open === null ? <RowListSkeleton label="Loading bounties" />
          : !open.length ? <EmptyState title="No open bounties" text={canAnswerIn
              ? `Bounties written in ${canAnswerIn} show up here. You can answer in languages you speak natively, or are verified at B1 or above in.`
              : 'Set your native language in your profile to answer bounties.'} />
          : <div className="space-y-3">
              {open.map((b) => <OpenCard key={b.message_id} bounty={b} language={nameOf(b.language_id)} onAnswered={() => void refresh()} />)}
              {more !== 'done' && <div className="flex justify-center"><Button variant="secondary" size="sm" loading={more === 'loading'} onClick={loadMore}>Load more</Button></div>}
            </div>)
        : tab === 'answers' ? (
          answers === null ? <RowListSkeleton label="Loading your answers" />
          : !answers.length ? <EmptyState title="No answers yet" text="Answers you send to bounties appear here, with the asker's decision." />
          : <div className="space-y-3">{answers.map((a) => <AnswerCard key={a.correction_id} answer={a} language={a.language_id ? nameOf(a.language_id) : ''} />)}</div>)
        : (mine === null ? <RowListSkeleton label="Loading bounties" />
          : !mine.length ? <EmptyState title="No bounties yet" text="In a chat, tap the coin next to the message box before sending. It costs 50 points, refunded if you don't accept an answer within 48 hours." />
          : <div className="space-y-3">{mine.map((b) => <MineCard key={b.message_id} bounty={b} language={b.language_id ? nameOf(b.language_id) : ''} />)}</div>)}
    </div>
  );
}

function OpenCard({ bounty, language, onAnswered }: { bounty: OpenBounty; language: string; onAnswered: () => void }) {
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState(bounty.body);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true); setError('');
    try { await answerBounty(bounty.message_id, text, note); setSent(true); setTimeout(onAnswered, 2500); }   // confirmation first, then it moves to My answers
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const name = bounty.asker_display_name ?? bounty.asker_username ?? 'Someone';
  return (
    <div className="ft-card space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar name={name} src={bounty.asker_avatar_url} size="xs" />
        <span className="font-semibold">{name}</span>
        <span className="text-muted">· {language} · {timeLeft(bounty.expires_at)}{bounty.answers ? ` · ${bounty.answers} answer${bounty.answers === 1 ? '' : 's'} so far` : ''}</span>
        <span className="ml-auto font-semibold text-brand">{bounty.cost} pts</span>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-surface-2 p-2 text-ink">{bounty.body}</p>
      {bounty.conversation_id && <p className="text-xs text-muted">From your chat with {name}. <Link className="font-semibold text-ink underline" to={`/messages/${bounty.conversation_id}`}>Open chat</Link></p>}
      {sent ? <p role="status" className="text-success">Sent. If {name} accepts your correction, you earn {bounty.cost} points.</p>
        : !answering ? <Button size="sm" onClick={() => setAnswering(true)}>Answer</Button>
        : (
          <div className="space-y-2">
            <Textarea label="Your corrected version" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
            {text.trim() !== bounty.body.trim() && <div className="rounded-md bg-surface-2 p-2"><DiffText original={bounty.body} corrected={text} /></div>}
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

function AnswerCard({ answer: a, language }: { answer: MyBountyAnswer; language: string }) {
  const name = a.asker_display_name ?? a.asker_username ?? 'Someone';
  const state = a.status === 'accepted'
    ? <Pill tone="good">{a.paid_to_me ? `Accepted · +${a.cost} pts` : 'Accepted'}</Pill>
    : a.status === 'dismissed' ? <Pill tone="bad">Declined</Pill>
    : a.status === 'superseded' ? <Pill tone="muted">Another answer chosen</Pill>
    : a.bounty_status === 'open' ? <Pill tone="open">Waiting · {timeLeft(a.expires_at)}</Pill>
    : <Pill tone="muted">Bounty expired · may still be accepted</Pill>;
  return (
    <div className="ft-card space-y-1.5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar name={name} src={a.asker_avatar_url} size="xs" />
        <span className="font-semibold">{name}</span>
        {language && <span className="text-muted">· {language}</span>}
        <span className="ml-auto">{state}</span>
      </div>
      <div className="rounded-md bg-surface-2 p-2 text-ink"><DiffText original={a.original} corrected={a.suggested_text} /></div>
      {a.decision_note && <p className="text-xs text-muted"><span className="font-semibold text-ink">Their reason:</span> {a.decision_note}</p>}
      {a.conversation_id && <Link className="text-xs font-semibold text-brand" to={`/messages/${a.conversation_id}`}>Open chat</Link>}
    </div>
  );
}

function MineCard({ bounty, language }: { bounty: MyBounty; language: string }) {
  const status = bounty.status === 'open'
    ? <Pill tone="open">{bounty.answers ? `${bounty.answers} to review` : 'Open'} · {timeLeft(bounty.expires_at)}</Pill>
    : bounty.status === 'paid' ? <Pill tone="good">Paid{bounty.paid_to_name || bounty.paid_to_username ? ` to ${bounty.paid_to_name ?? bounty.paid_to_username}` : ''}</Pill>
    : <Pill tone="muted">Refunded</Pill>;
  return (
    <div className="ft-card space-y-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        {status}
        {language && <span className="text-muted">{language}</span>}
        <span className="ml-auto font-semibold text-brand">{bounty.cost} pts</span>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-surface-2 p-2 text-ink">{bounty.body}</p>
      <div className="flex items-center justify-between text-muted">
        <span>{bounty.status === 'open' && bounty.answers ? 'Review the answers under your message in the chat.' : ''}</span>
        <Link to={`/messages/${bounty.conversation_id}`} className="text-brand">Open chat</Link>
      </div>
    </div>
  );
}

