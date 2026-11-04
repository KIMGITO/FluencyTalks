import clsx from 'clsx';
import { Bell, BellOff, Check, ChevronLeft, History, MessageSquarePlus, PencilLine, ThumbsUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Avatar, Button, Card, ConfirmDialog, DeniedState, ErrorState, ThreadSkeleton } from '@/components/ui';
import { Composer } from '@/components/features/review/Composer';
import { StatusPill } from '@/components/features/review/StatusPill';
import { LongBody } from '@/components/features/review/LongBody';
import { ThreadBranch } from '@/components/features/review/ThreadItemRow';
import { FIX_LABEL, hasLongBody, isPractice, POST_TYPE_LABEL, takesFixes } from '@/lib/postTypes';
import type { Sentence } from '@/lib/sentences';
import { timeAgo, waited } from '@/lib/format';
import { useAccountabilityStore } from '@/store/accountabilityStore';
import { useFeedCache } from '@/store/feedCache';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';
import { getPostThread, markDecisionsViewed, revertAccepted, setThreadMute, subscribeToThread, toggleEndorsement, type ItemKind, type PostThread, type ThreadItem } from '@/services/review';
import { listSavedPhraseTexts } from '@/services/phrasebook';
import { userMessage } from '@/lib/errors';

const HISTORY_LABEL: Record<string, string> = {
  submitted: 'submitted', accepted: 'accepted', declined: 'declined', superseded: 'superseded', withdrawn: 'withdrawn', resolved: 'resolved',
  clarification_requested: 'asked about a correction', flagged: 'flagged a correction', reverted: 'went back to the original', override: 'overrode a decision', endorsed: 'confirmed the post', extended: 'asked for more time', overdue: 'A decision passed its deadline', escalated: 'Passed to moderators',
};
const PAGE = 20;

export default function PostDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const targetId = useSearchParams()[0].get('item');
  const myId = useProfileStore((s) => s.me?.id ?? null);
  // Staff review a post here. They can decide on it as moderators, but don't take part in it.
  const readOnly = useProfileStore((s) => !!s.me && s.me.role !== 'user');
  const nameOf = useLanguageStore((s) => s.name);
  const loadAccountability = useAccountabilityStore((s) => s.load);
  const [thread, setThread] = useState<PostThread | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [composer, setComposer] = useState<ItemKind | null>(null);
  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [revert, setRevert] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [savedPhrases, setSavedPhrases] = useState<Set<string>>(() => new Set());
  const endorsing = useRef(false);   // a ref: taps in the same tick must see it straight away
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    const t = await getPostThread(id);
    setThread(t);
    setFailed(false);
    if (t) {
      const p = t.post;
      // Cards elsewhere show the same state without waiting for their next refresh.
      useFeedCache.getState().patchEverywhere(id, {
        current_phrase: p.current_phrase, current_translation: p.current_translation, current_body: p.current_body, review_status: p.review_status,
        open_corrections: p.open_corrections, thread_count: p.thread_count, endorse_count: p.endorse_count, accepted_item_id: p.accepted_item_id,
      });
    }
  }, [id]);
  // Thanking or accepting a fix also saves it, so a reload refreshes this too. Without the list, the button just reads "not saved yet".
  const loadSaved = useCallback(() => listSavedPhraseTexts().then((t) => setSavedPhrases(new Set(t))).catch(() => undefined), []);
  const reload = useCallback(async () => { await load(); void loadAccountability(); void loadSaved(); }, [load, loadAccountability, loadSaved]);
  useEffect(() => { void loadSaved(); }, [loadSaved]);

  useEffect(() => { setThread(undefined); scrolled.current = false; load().catch(() => setFailed(true)); }, [load]);
  useEffect(() => { if (id) markDecisionsViewed(id).catch(() => undefined); }, [id]);
  // A change from someone else: fetch again, a moment later so a burst is one request.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeToThread(id, () => { clearTimeout(t); t = setTimeout(() => { load().catch(() => undefined); }, 400); });
    return () => { clearTimeout(t); off(); };
  }, [id, load]);

  const { roots, ctx } = useMemo(() => {
    const items = thread?.items ?? [];
    const byId = new Map(items.map((i) => [i.id, i]));
    const children = new Map<string, ThreadItem[]>();
    const roots: ThreadItem[] = [];
    items.forEach((i) => {
      if (i.parent_id && byId.has(i.parent_id)) children.set(i.parent_id, [...(children.get(i.parent_id) ?? []), i]);
      else roots.push(i);
    });
    const targetPath = new Set<string>();
    let cur = targetId ? byId.get(targetId) : undefined;
    while (cur) { targetPath.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    return { roots, ctx: { byId, children, targetPath } };
  }, [thread?.items, targetId]);

  // Land on the exact correction a notification pointed at, with its branch open.
  useEffect(() => {
    if (!thread || !targetId || scrolled.current) return;
    scrolled.current = true;
    const rootIndex = roots.findIndex((r) => ctx.targetPath.has(r.id));
    if (rootIndex >= shown) setShown(rootIndex + 1);
    setTimeout(() => document.getElementById(`item-${targetId}`)?.scrollIntoView({ block: 'center' }), 60);
  }, [thread, targetId, roots, ctx.targetPath, shown]);

  const patchItem = (itemId: string, patch: Partial<ThreadItem>) =>
    setThread((t) => (t ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : t));
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/library'));

  if (thread === undefined && !failed) return <div className="ft-inset mx-auto w-full max-w-3xl py-4"><ThreadSkeleton /></div>;
  if (failed && !thread) {
    return (
      <div className="mx-auto w-full max-w-3xl py-4">
        <ErrorState title="Couldn't load this post" busy={retrying} onRetry={async () => {
          setRetrying(true);
          try { await load(); } catch { setFailed(true); } finally { setRetrying(false); }
        }} />
      </div>
    );
  }
  if (!thread) return <div className="mx-auto w-full max-w-3xl py-4"><DeniedState title="This post isn't available" text="It may have been removed, or you may not be able to see it." action={<Link to="/library" className="font-semibold underline">Back to the Library</Link>} /></div>;

  const { post, me, items, history, owner_record: record } = thread;
  const ownerName = post.author.display_name || post.author.username;
  const pending = items.filter((i) => i.status === 'pending');
  const waiting = items.filter((i) => i.responsible_open && i.waiting_since);
  const oldest = waiting.reduce<string | null>((o, i) => (!o || i.waiting_since! < o ? i.waiting_since : o), null);
  const anyOverdue = waiting.some((i) => i.due_at && new Date(i.due_at).getTime() <= Date.now());
  const hasCurrent = !!post.accepted_item_id;
  const helpType = isPractice(post.post_type) ? post.post_type : undefined;
  const longBody = hasLongBody(post.post_type) && !!post.body;
  const answered = helpType === 'question' || helpType === 'how_do_i_say';
  const setPhraseSaved = (phrase: string, saved: boolean) => setSavedPhrases((was) => {
    const next = new Set(was);
    if (saved) next.add(phrase); else next.delete(phrase);
    return next;
  });
  const threadCtx = { ...ctx, thread, targetId, reload, patchItem, ownerName, myId, readOnly, savedPhrases, setPhraseSaved };

  const endorse = async () => {
    if (endorsing.current) return;
    endorsing.current = true;
    const was = { endorsed: me.endorsed, count: post.endorse_count ?? 0 };
    setThread((t) => t && { ...t, me: { ...t.me, endorsed: !was.endorsed }, post: { ...t.post, endorse_count: was.count + (was.endorsed ? -1 : 1) } });
    try {
      await toggleEndorsement(id);
      await load();
    } catch (e) {
      setThread((t) => t && { ...t, me: { ...t.me, endorsed: was.endorsed }, post: { ...t.post, endorse_count: was.count } });
      toast.error(userMessage(e));
    } finally { endorsing.current = false; }
  };
  const mute = async () => {
    const was = me.muted;
    setThread((t) => t && { ...t, me: { ...t.me, muted: !was } });
    try { await setThreadMute(id, !was); toast.success(was ? 'You will hear about this discussion again.' : 'Muted. You will still hear about decisions you have to make.'); }
    catch (e) { setThread((t) => t && { ...t, me: { ...t.me, muted: was } }); toast.error(userMessage(e)); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 pb-24 md:pb-8">
      <button type="button" onClick={back} className="ft-inset flex min-h-9 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> Back</button>

      <Card className="space-y-3">
        <header className="flex items-center gap-2.5">
          <Link to={`/u/${post.author.username}`} className="shrink-0"><Avatar name={ownerName} src={post.author.avatar_url} size="md" /></Link>
          <div className="min-w-0 flex-1">
            <Link to={`/u/${post.author.username}`} className="block truncate font-semibold text-ink hover:underline">{ownerName}</Link>
            <p className="truncate text-xs text-muted">{timeAgo(post.created_at)}{post.language_id && ` · ${nameOf(post.language_id)}`} · {post.post_type === 'lesson' || helpType ? POST_TYPE_LABEL[post.post_type!] : post.category}</p>
          </div>
          <StatusPill status={post.review_status ?? 'awaiting_feedback'} label={answered && post.review_status === 'corrections_received' ? 'Answers received' : undefined} />
        </header>

        {post.current_body && (
          <section aria-label="With corrections applied" className="rounded-md border border-success/40 bg-success/5 p-3">
            <p className="ft-kicker text-success">With corrections applied</p>
            <p className="mt-1 whitespace-pre-line break-words font-display text-lg leading-8 text-ink">{post.current_body}</p>
          </section>
        )}
        {hasCurrent && (
          <section aria-label="Current accepted version" className="rounded-md border border-success/40 bg-success/5 p-3">
            <p className="ft-kicker text-success">Current accepted version</p>
            <p className="mt-1 whitespace-pre-line break-words text-lg font-semibold text-ink">{post.current_phrase ?? post.phrase}</p>
            {(post.current_translation ?? post.translation) && <p className="text-sm text-muted">{post.current_translation ?? post.translation}</p>}
          </section>
        )}
        <section aria-label="Original contribution">
          <p className="ft-kicker">{helpType ? `${ownerName} wrote` : 'Original contribution'}</p>
          <p className={clsx('mt-1 whitespace-pre-line break-words text-ink', hasCurrent ? 'text-sm' : 'text-lg font-semibold')}>{post.phrase}</p>
          {longBody && (
            <div className="mt-2">
              <LongBody body={post.body!} items={items} canFix={me.can_review && !readOnly && !me.is_owner} selected={sentence} onPick={(s) => { setComposer('correction'); setSentence(s); }} locale={post.language_id ?? undefined} />
              {me.can_review && !readOnly && !me.is_owner && <p className="mt-1 text-xs text-muted">Tap a sentence to fix it.</p>}
            </div>
          )}
          {!longBody && post.body && <p className="mt-1 whitespace-pre-line break-words text-ink">{post.body}</p>}
          {post.translation && <p className="text-sm text-muted">{post.translation}</p>}
          {post.source_context && <p className="mt-1 text-sm text-muted">{(helpType === 'correct_me' || helpType === 'photo') && 'Trying to say: '}{post.source_context}</p>}
          {post.unsplash_image_url && <img src={post.unsplash_image_url} alt="" loading="lazy" className="mt-2 aspect-[4/3] w-full rounded-md object-cover" />}
        </section>

        {waiting.length > 0 && (
          <p className={clsx('rounded-md p-2.5 text-sm font-semibold', anyOverdue ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning')}>
            {me.is_owner ? 'You need to decide' : `Waiting for ${ownerName}`}: {waiting.length} open{oldest && `, the oldest waiting for ${waited(oldest)}`}{anyOverdue && ', overdue'}.
            {!hasCurrent && !me.is_owner && ' Until then the original stands.'}
          </p>
        )}
        {!helpType && record.decided > 0 && <p className="text-xs text-muted">{ownerName} has answered {record.on_time} of {record.decided} corrections on time.</p>}

        <div className="flex flex-wrap items-center gap-2">
          {helpType && me.can_review && !readOnly && !me.is_owner && takesFixes(helpType) && (
            <>
              {!longBody && <Button size="sm" aria-expanded={composer === 'correction'} onClick={() => setComposer(composer === 'correction' ? null : 'correction')}><PencilLine size={14} aria-hidden /> {FIX_LABEL[helpType]}</Button>}
              {helpType !== 'how_do_i_say' && (
                <Button size="sm" variant={me.endorsed ? 'primary' : 'secondary'} aria-pressed={me.endorsed} onClick={endorse}>
                  <ThumbsUp size={14} aria-hidden className={me.endorsed ? 'ft-pop' : undefined} /> {me.endorsed ? 'You confirmed' : 'This is correct'}{(post.endorse_count ?? 0) > 0 && ` · ${post.endorse_count}`}
                </Button>
              )}
            </>
          )}
          {!helpType && me.can_review && !readOnly && (
            <>
              <Button size="sm" variant={me.endorsed ? 'primary' : 'secondary'} aria-pressed={me.endorsed} onClick={endorse}>
                <ThumbsUp size={14} aria-hidden className={me.endorsed ? 'ft-pop' : undefined} /> {me.endorsed ? 'You confirmed' : 'This is correct'}{(post.endorse_count ?? 0) > 0 && ` · ${post.endorse_count}`}
              </Button>
              {!longBody && <Button size="sm" variant="secondary" aria-expanded={composer === 'correction'} onClick={() => setComposer(composer === 'correction' ? null : 'correction')}><PencilLine size={14} aria-hidden /> Correct</Button>}
              <Button size="sm" variant="ghost" aria-expanded={composer === 'clarification'} onClick={() => setComposer(composer === 'clarification' ? null : 'clarification')}>Ask</Button>
            </>
          )}
          {!me.can_review && (post.endorse_count ?? 0) > 0 && <span className="inline-flex items-center gap-1 text-xs text-muted"><Check size={14} aria-hidden /> {post.endorse_count} confirmed this is correct</span>}
          {!readOnly && <Button size="sm" variant="ghost" aria-expanded={composer === 'comment'} onClick={() => setComposer(composer === 'comment' ? null : 'comment')}><MessageSquarePlus size={14} aria-hidden /> Reply</Button>}
          {(me.is_owner || me.is_moderator) && !helpType && (hasCurrent || !!post.current_body) && <Button size="sm" variant="ghost" onClick={() => setRevert(true)}>Go back to the original</Button>}
          {!readOnly && <button type="button" aria-pressed={me.muted} aria-label={me.muted ? 'Unmute this discussion' : 'Mute this discussion'} title={me.muted ? 'Unmute' : 'Mute'} onClick={mute} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            {me.muted ? <BellOff size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
          </button>}
        </div>
        {helpType && me.is_owner && <p className="text-xs text-muted">Nothing here needs a decision from you, and there's no deadline. {takesFixes(helpType) && 'Fixes you thank go to your phrasebook.'}</p>}
        {!readOnly && !me.can_review && !me.is_owner && <p className="text-xs text-muted">{helpType === 'question' ? 'Anyone can reply.' : `${helpType ? 'Fixes' : 'Corrections'} come from native speakers and learners verified at B1 in this language. Anyone can reply.`}</p>}
        {composer && (
          <Composer postId={id} parentId={null} kind={composer} currentPhrase={post.current_phrase ?? post.phrase} currentTranslation={post.current_translation ?? post.translation} helpType={composer === 'correction' && helpType && helpType !== 'question' ? helpType : undefined}
            target={composer === 'correction' && longBody ? sentence : null}
            key={sentence?.start ?? composer}
            onCancel={() => { setComposer(null); setSentence(null); }} onDone={async () => { setComposer(null); setSentence(null); await reload(); }} />
        )}
      </Card>

      <section aria-label="Discussion" className="ft-card">
        <h2 className="flex items-baseline gap-2 border-b border-border px-4 py-3 font-display text-xl font-medium">
          {helpType === 'question' ? 'Replies' : helpType ? 'Fixes and replies' : 'Discussion'} <span className="font-sans text-sm text-muted">{items.length}{!helpType && pending.length > 0 && ` · ${pending.length} open`}</span>
        </h2>
        <div className="px-3 py-2 md:px-4">
        {roots.length === 0
          ? <p className="py-6 text-center text-sm text-muted">{helpType
              ? (me.is_owner ? 'Nobody has answered yet. You will be told as soon as someone does.' : helpType === 'question' ? 'No replies yet. You could be the first.' : me.can_review ? 'No fixes yet. You could be the first to help.' : 'No fixes yet.')
              : me.is_owner ? 'Nobody has reviewed this yet. You will be told when they do.' : 'No corrections yet. Is it right? Confirm it, or propose a correction.'}</p>
          : <ul className="ft-tree space-y-1">{roots.slice(0, shown).map((r) => <ThreadBranch key={r.id} item={r} ctx={threadCtx} />)}</ul>}
        {roots.length > shown && <Button size="sm" variant="secondary" full className="mt-2" onClick={() => setShown((n) => n + PAGE)}>Show more ({roots.length - shown})</Button>}
        </div>
      </section>

      {history.length > 0 && (
        <details className="ft-inset group">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><History size={15} aria-hidden /> {helpType ? 'History' : 'Decision history'} ({history.length})</summary>
          <ol className="mt-1 space-y-1.5 border-l-2 border-border pl-3 text-xs text-muted">
            {history.map((e) => (
              <li key={e.id}>
                <span className="font-semibold text-ink">{e.actor_name ?? ''}</span> {HISTORY_LABEL[e.action] ?? e.action} · {timeAgo(e.created_at)}
                {e.item_id && <> · <a href={`#item-${e.item_id}`} className="underline">see it</a></>}
                {e.note && <span className="block italic">“{e.note}”</span>}
              </li>
            ))}
          </ol>
        </details>
      )}

      <ConfirmDialog open={revert} title="Go back to the original?" confirmLabel="Go back" danger reasonLabel="Why? (the author of the correction sees this)" reasonRequired
        onClose={() => setRevert(false)}
        onConfirm={async (note) => { await revertAccepted(id, note); toast.success('The original is current again.'); await reload(); }}>
        {post.current_body ? 'Every accepted correction on this post will be marked declined.' : 'The accepted correction will be marked declined.'} Everything stays in the history.
      </ConfirmDialog>
    </div>
  );
}
