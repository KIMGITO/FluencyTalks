import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Eye, Languages, Pencil, StickyNote, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, Card, EmptyState, Modal, Spinner, Textarea } from '@/components/ui';
import { PostBody } from '@/components/features/posts';
import { addPostNote, deletePost, deletePostNote, getPost, listPostNotes, listPostReaders, togglePostRead, togglePostSave } from '@/services/posts';
import { translateText } from '@/lib/translate';
import { blocksToText } from '@/lib/blocks';
import { formatTime } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import type { Post, PostNote, PostReader } from '@/types/posts';

export default function PostDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const uid = useAuthStore((s) => s.user?.id);
  const me = useProfileStore((s) => s.me);
  const languages = useProfileStore((s) => s.languages);
  const provider = useLanguageStore((s) => s.provider);
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  const staff = me?.role === 'admin' || me?.role === 'moderator';
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [readers, setReaders] = useState<PostReader[] | null>(null);
  const [showReaders, setShowReaders] = useState(false);
  const [eyeOpen, setEyeOpen] = useState(false);
  const [notes, setNotes] = useState<PostNote[]>([]);
  const [note, setNote] = useState('');
  const [trTarget, setTrTarget] = useState('');
  const [tr, setTr] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; text: string }>({ state: 'idle', text: '' });
  const mine = !!uid && !!post && (post.author_id === uid || !!staff);
  const plain = useMemo(() => (post ? blocksToText(post.blocks ?? []) || post.body_text : ''), [post]);
  const learnOpts = useMemo(() => languages.filter((l) => l.role === 'learning').map((l) => ({ id: l.language_id, label: labelOf(l, locales) })), [languages, labelOf, locales]);
  useEffect(() => {
    setPost(undefined);
    getPost(id).then((p) => {
      setPost(p);
      if (p) { setTrTarget(languages.find((l) => l.role === 'learning')?.language_id ?? languages.find((l) => l.role === 'native')?.language_id ?? ''); }
    }).catch(() => setPost(null));
    listPostNotes(id).then(setNotes).catch(() => {});
  }, [id]);
  useEffect(() => {
    if (showReaders && post && readers === null) listPostReaders(post.id).then(setReaders).catch(() => setReaders([]));
  }, [showReaders, post]);
  if (post === undefined) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (post === null) return <EmptyState title="Post unavailable" text="It may have been deleted or is not shared with you." action={<Link to="/posts"><Button>Back to stories</Button></Link>} />;
  const read = async () => {
    if (!eyeOpen) { setEyeOpen(true); return; }
    const has = await togglePostRead(post.id);
    setPost({ ...post, has_read: has, read_count: post.read_count + (has ? 1 : -1) });
    setReaders(null);
  };
  const save = async () => { const s = await togglePostSave(post.id); setPost({ ...post, saved: s }); };
  const del = async () => {
    if (!confirm('Delete this post?')) return;
    await deletePost(post.id); nav('/posts');
  };
  const translate = async () => {
    if (!plain.trim() || !trTarget) return;
    setTr({ state: 'loading', text: '' });
    try {
      const out = await translateText(plain, trTarget, provider(trTarget));
      setTr({ state: 'done', text: out });
    } catch (e) { setTr({ state: 'error', text: e instanceof Error ? e.message : 'Could not translate.' }); }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    const nid = await addPostNote(post.id, note.trim());
    setNotes([{ id: nid, note: note.trim(), created_at: new Date().toISOString(), user_id: uid ?? '', username: me?.username ?? null, display_name: me?.display_name ?? null, avatar_url: me?.avatar_url ?? null, mine: true }, ...notes]);
    setNote(''); setPost({ ...post, notes_count: post.notes_count + 1 });
  };
  return (
    <>
      <PageHeader title={post.kind === 'blog' ? 'Blog' : 'Story'} subtitle={`${post.author_name ?? ''} \u00b7 ${formatTime(post.created_at)}`} />
      <div className="flex flex-col gap-3">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link to={post.author_username ? `/u/${post.author_username}` : '#'}><Avatar name={post.author_name ?? '?'} src={post.author_avatar} size="sm" /></Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{post.author_name}</p>
              <p className="text-xs text-muted">{post.author_username ? `@${post.author_username}` : ''}</p>
            </div>
            {mine && (
              <div className="flex gap-1">
                <Link to={`/posts/${post.id}/edit`} aria-label="Edit" className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={15} /></Link>
                <button aria-label="Delete" onClick={del} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-danger"><Trash2 size={15} /></button>
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold leading-tight">{post.title}</h1>
          <PostBody blocks={post.blocks} />
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <button onClick={read} aria-label="I have read this"
              className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition', post.has_read ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}>
              <Eye size={16} /> {eyeOpen || post.has_read ? post.read_count : 'Reads'}{post.has_read ? ' \u00b7 Read' : ''}
            </button>
            {mine && (
              <button onClick={() => setShowReaders(true)} className="text-xs font-semibold text-brand hover:underline">Who has read ({post.read_count})</button>
            )}
            <button onClick={save} className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition', post.saved ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}>
              <Bookmark size={15} fill={post.saved ? 'currentColor' : 'none'} /> {post.saved ? 'Saved' : 'Save link'}
            </button>
          </div>
        </Card>
        {uid && (
        <Card className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 font-semibold"><Languages size={16} /> Translate this {post.kind}</h2>
          <p className="text-xs text-muted">Translate to your native language or the one you are learning.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={trTarget} onChange={(e) => setTrTarget(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" aria-label="Translate to">
              <option value="">Pick language...</option>
              {learnOpts.map((l) => <option key={l.id} value={l.id}>{l.label} (learning)</option>)}
              {languages.filter((l) => l.role === 'native').map((l) => <option key={l.language_id} value={l.language_id}>{labelOf(l, locales)} (native)</option>)}
            </select>
            <Button size="sm" onClick={translate} disabled={!trTarget || tr.state === 'loading'}>{tr.state === 'loading' ? 'Translating...' : 'Translate'}</Button>
          </div>
          {tr.state === 'done' && <p className="ft-selectable whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-sm leading-relaxed">{tr.text}</p>}
          {tr.state === 'error' && <p className="text-sm text-danger">{tr.text}</p>}
        </Card>
        )}
        <Card className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 font-semibold"><StickyNote size={16} /> What did you capture / learn? ({post.notes_count})</h2>
          <div className="flex flex-col gap-2">
            <Textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write what this story taught you..." />
            <Button size="sm" className="self-end" onClick={addNote} disabled={!note.trim()}>Save note</Button>
          </div>
          <div className="flex flex-col gap-1.5">
            {notes.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-md bg-surface-2/60 p-2">
                <Avatar name={n.display_name ?? '?'} src={n.avatar_url} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{n.mine ? 'You' : n.display_name}{n.mine ? '' : n.username ? ` @${n.username}` : ''}</p>
                  <p className="ft-selectable whitespace-pre-wrap break-words text-sm">{n.note}</p>
                </div>
                {(n.mine || mine) && <button aria-label="Delete note" className="text-muted hover:text-danger" onClick={async () => { await deletePostNote(n.id); setNotes(notes.filter((x) => x.id !== n.id)); }}><Trash2 size={14} /></button>}
              </div>
            ))}
            {!notes.length && <p className="text-sm text-muted">No notes yet. Be the first to write what you learnt.</p>}
          </div>
        </Card>
      </div>
      <Modal open={showReaders} onClose={() => setShowReaders(false)} title={`Read by ${post.read_count}`}>
        {!readers ? <div className="flex justify-center p-4"><Spinner /></div>
        : !readers.length ? <p className="text-sm text-muted">Nobody has tapped the eye yet.</p>
        : <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">{readers.map((r) => (
            <Link key={r.id} to={r.username ? `/u/${r.username}` : '#'} className="flex items-center gap-2" onClick={() => setShowReaders(false)}>
              <Avatar name={r.display_name ?? '?'} src={r.avatar_url} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.display_name}<span className="block truncate text-xs font-normal text-muted">{r.username ? `@${r.username}` : ''} \u00b7 {formatTime(r.read_at)}</span></span>
            </Link>))}</div>}
      </Modal>
    </>
  );
}
