import clsx from 'clsx';
import { BookmarkPlus, Check, CornerDownRight, Flag, MoreHorizontal, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, ConfirmDialog } from '@/components/ui';
import { DiffText } from '@/components/features/chat/DiffText';
import { timeAgo, waited } from '@/lib/format';
import { toast } from '@/store/toastStore';
import { savePhrase } from '@/services/phrasebook';
import { askAboutCorrection, decideCorrection, overrideCorrection, rateHelpFix, resolveClarification, toggleAgreement, toggleFlag, withdrawDiscussion, type PostThread, type ThreadItem } from '@/services/review';
import { hasLongBody, isPractice } from '@/lib/postTypes';
import { Composer, newKey } from './Composer';
import { StatusPill } from './StatusPill';
import { userMessage } from '@/lib/errors';

/** How far a branch indents before it stops and relies on "replying to" labels instead. */
const MAX_INDENT = 3;
/** Deeper branches start folded unless they hold what a notification pointed at. */
const OPEN_DEPTH = 3;

export const dueLabel = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'overdue';
  const h = Math.ceil(ms / 3_600_000);
  return h < 48 ? `due in ${h}h` : `due in ${Math.ceil(h / 24)}d`;
};

type Ctx = {
  readOnly: boolean;
  thread: PostThread;
  byId: Map<string, ThreadItem>;
  children: Map<string, ThreadItem[]>;
  targetPath: Set<string>;
  targetId: string | null;
  reload: () => Promise<void>;
  patchItem: (id: string, patch: Partial<ThreadItem>) => void;
  ownerName: string;
  myId: string | null;
};

const countBelow = (id: string, children: Ctx['children']): number =>
  (children.get(id) ?? []).reduce((n, c) => n + 1 + countBelow(c.id, children), 0);

function kindLabel(item: ThreadItem, parent: ThreadItem | undefined, helpPost = false) {
  if (item.kind === 'clarification') return 'Clarification request';
  if (item.kind === 'comment') return 'Reply';
  if (helpPost) return 'Fix';
  return parent?.kind === 'correction' ? 'Correction of a correction' : 'Correction';
}

/** branch: drawn as an indented reply with a connector to its parent (see .ft-tree in index.css). */
export function ThreadBranch({ item, ctx, level = 0, branch = false }: { item: ThreadItem; ctx: Ctx; level?: number; branch?: boolean }) {
  const { thread, byId, children, targetPath, targetId, reload, patchItem, ownerName } = ctx;
  const { me, post } = thread;
  const kids = children.get(item.id) ?? [];
  const below = countBelow(item.id, children);
  // Like Facebook: the first reply shows, the rest wait behind "View N more replies". Deep branches start folded.
  // A notification's target is always reachable without a tap.
  const [show, setShow] = useState<'none' | 'first' | 'all'>(() =>
    kids.slice(1).some((k) => targetPath.has(k.id)) ? 'all' : level < OPEN_DEPTH || targetPath.has(item.id) ? 'first' : 'none');
  const visibleKids = show === 'none' ? [] : show === 'first' ? kids.slice(0, 1) : kids;
  const hiddenBelow = kids.slice(visibleKids.length).reduce((n, k) => n + 1 + countBelow(k.id, children), 0);
  const indent = level < MAX_INDENT;
  const [composer, setComposer] = useState<'comment' | 'correction' | null>(null);
  const [dialog, setDialog] = useState<'accept' | 'decline' | 'ask' | 'not-helpful' | 'withdraw' | 'resolve' | 'override-accepted' | 'override-declined' | 'override-pending' | null>(null);
  const [menu, setMenu] = useState(false);
  const agreeing = useRef(false);   // a ref: taps in the same tick must see it straight away
  const askKey = useRef(newKey());   // a repeated tap can't ask twice

  const parent = item.parent_id ? byId.get(item.parent_id) : undefined;
  const mine = !!item.author && item.author.id === ctx.myId;
  const isCorrection = item.kind === 'correction';
  const helpPost = isPractice(post.post_type);
  const helpType = isPractice(post.post_type) && post.post_type !== 'question' ? post.post_type : undefined;
  const decider = (me.is_owner || me.is_moderator) && !mine;
  const asModerator = me.is_moderator && !me.is_owner;
  const canDecide = !helpPost && isCorrection && item.status === 'pending' && decider;
  const canCounter = !ctx.readOnly && isCorrection && !mine && !me.is_owner && me.can_review && (item.status === 'pending' || item.status === 'accepted');
  const authorName = item.hidden ? 'Hidden' : item.author?.display_name ?? 'Deleted account';
  // What this proposal would replace: its parent's proposal, or the post as it stands.
  const fromPhrase = parent?.proposed_phrase ?? item.target_text ?? post.current_phrase ?? post.phrase;
  const fromTranslation = parent?.proposed_translation ?? post.current_translation ?? post.translation ?? '';
  const overdue = item.responsible_open && item.due_at && new Date(item.due_at).getTime() <= Date.now();

  const decide = async (accept: boolean, note: string) => {
    try {
      const out = await decideCorrection(item.id, accept, note);
      toast.success(out === 'accepted' ? 'Accepted and added to your phrasebook. The original is kept.' : 'Declined. The author has been told.');
      await reload();
    } catch (e) {
      // Someone got there first: show what actually happened rather than an error alone.
      await reload();
      throw e;
    }
  };

  // Optimistic would hide a failure: this one is final and pays the helper, so wait for the answer.
  const rate = async (helpful: boolean, note?: string) => {
    try {
      await rateHelpFix(item.id, helpful, note);
      toast.success(helpful ? 'Thanks sent, and added to your phrasebook.' : 'Noted. Thanks for telling us.');
      await reload();
    } catch (e) {
      toast.error(userMessage(e));
      await reload();
    }
  };
  const keep = async () => {
    try {
      await savePhrase({ phrase: item.proposed_phrase!, languageCode: post.language_id ?? undefined, sourcePostId: post.id });
      toast.success('Added to your phrasebook.');
    } catch (e) { toast.error(userMessage(e)); }
  };

  const agree = async () => {
    if (agreeing.current) return;
    agreeing.current = true;
    const was = { i_agreed: item.i_agreed, agree_count: item.agree_count };
    patchItem(item.id, { i_agreed: !was.i_agreed, agree_count: was.agree_count + (was.i_agreed ? -1 : 1) });
    try {
      const now = await toggleAgreement(item.id);
      patchItem(item.id, { i_agreed: now, agree_count: was.agree_count + (now === was.i_agreed ? 0 : now ? 1 : -1) });
    } catch (e) {
      patchItem(item.id, was);
      toast.error(userMessage(e));
    } finally { agreeing.current = false; }
  };

  const flag = async () => {
    try {
      const now = await toggleFlag(item.id);
      patchItem(item.id, { i_flagged: now, flag_count: item.flag_count + (now ? 1 : -1), ...(now && item.i_agreed ? { i_agreed: false, agree_count: item.agree_count - 1 } : {}) });
      if (now) toast.success('Flagged. The author can see that someone thinks this is wrong.');
    } catch (e) { toast.error(userMessage(e)); }
  };

  return (
    <li id={`item-${item.id}`} className={clsx('scroll-mt-20', branch && 'ft-child')}>
      <article className={clsx('rounded-md px-1 py-2', targetId === item.id && 'ft-target', indent && kids.length > 0 && 'ft-descend')} aria-label={`${kindLabel(item, parent, helpPost)} by ${authorName}`}>
        <header className="flex items-start gap-2">
          {item.author && !item.hidden
            ? <Link to={`/u/${item.author.username}`} className="shrink-0"><Avatar name={authorName} src={item.author.avatar_url} size="sm" /></Link>
            : <Avatar name="?" size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
              {item.author && !item.hidden
                ? <Link to={`/u/${item.author.username}`} className="font-semibold text-ink hover:underline">{authorName}</Link>
                : <span className="font-semibold text-muted">{authorName}</span>}
              {item.author?.id === post.user_id && <span className="ft-tag">Author</span>}
              <span className="text-xs text-muted">{timeAgo(item.created_at)}</span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className={clsx('font-semibold', isCorrection && 'text-ink')}>{kindLabel(item, parent, helpPost)}</span>
              {item.status && !helpPost && <StatusPill status={item.status} />}
              {helpPost && item.status === 'accepted' && <span className="font-semibold text-success">Thanked</span>}
            </p>
          </div>
          {(me.is_moderator && isCorrection && !helpPost) && (
            <div className="relative">
              <button type="button" aria-label="Moderator actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><MoreHorizontal size={16} aria-hidden /></button>
              {menu && (
                <div className="ft-menu right-0 mt-1" role="menu">
                  {(['accepted', 'declined', 'pending'] as const).filter((s) => s !== item.status).map((s) => (
                    <button key={s} role="menuitem" className="ft-menu-item" onClick={() => { setMenu(false); setDialog(`override-${s}`); }}>Set to {s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        <div className="mt-1.5 space-y-1.5 pl-10 text-sm">
          {level >= MAX_INDENT && parent && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <CornerDownRight size={12} aria-hidden /> Replying to
              <a href={`#item-${parent.id}`} className="font-semibold underline underline-offset-2">{parent.hidden ? 'a hidden item' : parent.author?.display_name ?? 'a deleted account'}</a>
            </p>
          )}
          {item.hidden ? <p className="italic text-muted">Hidden because of a block.</p> : (
            <>
              {isCorrection && (
                <div className="space-y-1 rounded-md bg-surface-2 p-2.5">
                  {item.target_text && !parent?.proposed_phrase && <p className="text-2xs font-bold uppercase tracking-wide text-muted">One sentence</p>}
                  {item.proposed_phrase && (post.post_type === 'how_do_i_say'
                    ? <p className="whitespace-pre-line break-words font-semibold text-ink">{item.proposed_phrase}</p>
                    : <DiffText original={fromPhrase} corrected={item.proposed_phrase} />)}
                  {item.proposed_translation && (
                    <div className="text-xs text-muted"><span className="font-semibold">Translation:</span> <DiffText original={fromTranslation} corrected={item.proposed_translation} /></div>
                  )}
                </div>
              )}
              <p className="whitespace-pre-line break-words text-ink">{item.body}</p>
            </>
          )}
          {item.status && item.status !== 'pending' && !helpPost && (
            <p className="text-xs text-muted">
              {item.status[0].toUpperCase() + item.status.slice(1)}{item.decided_by_name && ` by ${item.decided_by_name}`}{item.decided_at && ` · ${timeAgo(item.decided_at)}`}
              {item.decision_note && <span className="block italic">“{item.decision_note}”</span>}
            </p>
          )}
          {item.responsible_open && item.waiting_since && item.due_at && (
            <p className={clsx('text-xs font-semibold', overdue ? 'text-danger' : 'text-warning')}>
              Waiting for {me.is_owner ? 'you' : ownerName} for {waited(item.waiting_since)} · {dueLabel(item.due_at)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-0.5">
            {helpPost && isCorrection && me.is_owner && item.status === 'pending' && !item.hidden && !ctx.readOnly && (
              <>
                <Button size="sm" onClick={() => void rate(true)}><Check size={14} aria-hidden /> Thanks</Button>
                <button type="button" aria-label="Not helpful" title="Not helpful" onClick={() => setDialog('not-helpful')} className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"><ThumbsDown size={14} aria-hidden /></button>
              </>
            )}
            {(helpPost || item.status === 'accepted') && isCorrection && !mine && !item.hidden && !ctx.readOnly && item.proposed_phrase && item.status !== 'declined' && item.status !== 'withdrawn' && (hasLongBody(post.post_type) ? item.target_text : true) && (
              <Button size="sm" variant="secondary" onClick={() => void keep()}><BookmarkPlus size={14} aria-hidden /> Add to phrasebook</Button>
            )}
            {canDecide && (
              <>
                <Button size="sm" onClick={() => setDialog('accept')}><Check size={14} aria-hidden /> Accept</Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog('decline')}>Decline</Button>
                {me.is_owner && <Button size="sm" variant="ghost" onClick={() => setDialog('ask')}>Ask about it</Button>}
              </>
            )}
            {item.kind === 'clarification' && item.status === 'pending' && (decider || mine) && (
              <Button size="sm" variant="secondary" onClick={() => setDialog('resolve')}>Close with an answer</Button>
            )}
            {!ctx.readOnly && isCorrection && !mine && !item.hidden && (
              <button type="button" aria-pressed={item.i_agreed} aria-label={`Agree, ${item.agree_count} so far`} onClick={agree}
                className={clsx('inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition', item.i_agreed ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
                <ThumbsUp size={14} aria-hidden className={item.i_agreed ? 'ft-pop' : undefined} /> Agree{item.agree_count > 0 && ` · ${item.agree_count}`}
              </button>
            )}
            {isCorrection && mine && item.agree_count > 0 && <span className="px-1 text-xs text-muted">{item.agree_count} agree</span>}
            {!ctx.readOnly && isCorrection && !mine && !item.hidden && me.can_review && !me.is_owner && (
              <button type="button" aria-pressed={item.i_flagged} aria-label={`Flag as wrong, ${item.flag_count} so far`} onClick={() => void flag()}
                className={clsx('inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition', item.i_flagged ? 'bg-warning/15 text-warning' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
                <Flag size={14} aria-hidden /> Wrong?{item.flag_count > 0 && ` · ${item.flag_count}`}
              </button>
            )}
            {isCorrection && (mine || me.is_owner || !me.can_review) && item.flag_count > 0 && <span className="px-1 text-xs text-warning">{item.flag_count} {item.flag_count === 1 ? 'person thinks' : 'people think'} this is wrong</span>}
            {!ctx.readOnly && !item.hidden && (
              <button type="button" aria-expanded={composer === 'comment'} onClick={() => setComposer(composer === 'comment' ? null : 'comment')} className="inline-flex min-h-10 items-center rounded-full px-2.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink">Reply</button>
            )}
            {canCounter && (
              <button type="button" aria-expanded={composer === 'correction'} onClick={() => setComposer(composer === 'correction' ? null : 'correction')} className="inline-flex min-h-10 items-center rounded-full px-2.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink">Correct this</button>
            )}
            {mine && item.status === 'pending' && (
              <button type="button" onClick={() => setDialog('withdraw')} className="inline-flex min-h-10 items-center rounded-full px-2.5 text-xs font-semibold text-muted transition hover:bg-danger/10 hover:text-danger">Withdraw</button>
            )}
          </div>

          {composer && (
            <Composer
              postId={post.id} parentId={item.id} kind={composer}
              currentPhrase={item.proposed_phrase ?? fromPhrase} currentTranslation={item.proposed_translation ?? fromTranslation}
              helpType={composer === 'correction' ? helpType : undefined} noTranslation={!!item.target_text}
              onCancel={() => setComposer(null)}
              onDone={async () => { setComposer(null); setShow('all'); await reload(); }}
            />
          )}
        </div>
      </article>

      {kids.length > 0 && (
        // Past MAX_INDENT the tree stops stepping right; "Replying to" names the parent instead.
        <ul className={indent ? 'ft-children' : undefined} aria-label={`Replies to ${authorName}`}>
          {visibleKids.map((k) => <ThreadBranch key={k.id} item={k} ctx={ctx} level={level + 1} branch={indent} />)}
          {hiddenBelow > 0 && (
            <li className={clsx(indent && 'ft-child ft-child-more')}>
              <button type="button" aria-expanded={false} onClick={() => setShow('all')}
                className="inline-flex min-h-10 items-center rounded-full px-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                {show === 'none' ? `View ${below} ${below === 1 ? 'reply' : 'replies'}` : `View ${hiddenBelow} more ${hiddenBelow === 1 ? 'reply' : 'replies'}`}
              </button>
            </li>
          )}
        </ul>
      )}

      <ConfirmDialog open={dialog === 'accept'} title="Accept this correction?" confirmLabel="Accept"
        reasonLabel={asModerator ? 'Reason (required for moderators)' : 'Add a note (optional)'} reasonRequired={asModerator}
        onClose={() => setDialog(null)} onConfirm={(note) => decide(true, note)}>
        {item.target_text ? 'This sentence reads corrected on your post.' : 'It becomes the current version shown on your post.'} The original and the rest of the discussion stay, and it goes to your phrasebook. {post.accepted_item_id && !item.target_text ? 'The correction accepted before it will be marked superseded. ' : ''}Other open proposals stay open.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'decline'} title="Decline this correction?" confirmLabel="Decline"
        reasonLabel={asModerator ? 'Reason (required for moderators)' : 'Say why (optional, the author sees it)'} reasonRequired={asModerator}
        onClose={() => setDialog(null)} onConfirm={(note) => decide(false, note)}>
        It stays in the thread, marked declined. The author is told.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'ask'} title="Ask about this correction" confirmLabel="Ask" reasonLabel="What would you like to know?" reasonRequired
        onClose={() => setDialog(null)}
        onConfirm={async (question) => { await askAboutCorrection(item.id, question, askKey.current); toast.success('Asked. You have more time to decide.'); await reload(); }}>
        {item.author?.display_name ?? 'The author'} sees your question in this thread. Your deadline restarts, once per correction.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'not-helpful'} title="This fix didn't help?" confirmLabel="Not helpful" reasonLabel="Say why (optional, the author sees it)"
        onClose={() => setDialog(null)} onConfirm={(note) => rate(false, note)}>
        It stays in the thread. This can't be changed afterwards.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'withdraw'} title="Withdraw this?" confirmLabel="Withdraw" danger
        onClose={() => setDialog(null)}
        onConfirm={async () => { await withdrawDiscussion(item.id); toast.success('Withdrawn. It stays in the history.'); await reload(); }}>
        It stays visible, marked withdrawn, and no longer needs a decision. This can't be undone.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'resolve'} title="Close this clarification" confirmLabel="Close it" reasonLabel="The answer" reasonRequired
        onClose={() => setDialog(null)}
        onConfirm={async (note) => { await resolveClarification(item.id, note); toast.success('Closed.'); await reload(); }} />
      {(['accepted', 'declined', 'pending'] as const).map((s) => (
        <ConfirmDialog key={s} open={dialog === `override-${s}`} title={`Set this correction to ${s}?`} confirmLabel="Change it" danger reasonLabel="Reason (kept on the record, and shown to both people)" reasonRequired
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await overrideCorrection(item.id, s, reason); toast.success('Decision changed.'); await reload(); }}>
          This overrides the current decision.
        </ConfirmDialog>
      ))}
    </li>
  );
}
