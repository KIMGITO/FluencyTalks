import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Eye, Lock, Pencil, Trash2, Users } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Card } from '@/components/ui';
import { PostBody } from './PostBody';
import { togglePostRead, togglePostSave } from '@/services/posts';
import { formatTime } from '@/lib/format';
import { useLanguageStore } from '@/store/languageStore';
import type { Post } from '@/types/posts';

const visIcon = (v: Post['visibility']) => v === 'followers' ? <Users size={12} /> : v === 'private' ? <Lock size={12} /> : null;

export function PostCard({ post, mine, onChanged, onDeleted }: { post: Post; mine: boolean; onChanged: (p: Post) => void; onDeleted: (id: string) => void }) {
  const [p, setP] = useState(post);
  const [eyeOpen, setEyeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const langName = useLanguageStore((s) => s.name);
  const sync = (patch: Partial<Post>) => { const n = { ...p, ...patch }; setP(n); onChanged(n); };
  const read = async () => {
    if (!eyeOpen) { setEyeOpen(true); return; }
    setBusy(true);
    try { const has = await togglePostRead(p.id); sync({ has_read: has, read_count: p.read_count + (has ? 1 : -1) }); }
    catch { /* keep count */ } finally { setBusy(false); }
  };
  const save = async () => {
    try { const s = await togglePostSave(p.id); sync({ saved: s }); }
    catch { /* noop */ }
  };
  const del = async () => {
    if (!confirm('Delete this post?')) return;
    const { deletePost } = await import('@/services/posts');
    await deletePost(p.id); onDeleted(p.id);
  };
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Link to={p.author_username ? `/u/${p.author_username}` : '#'}><Avatar name={p.author_name ?? '?'} src={p.author_avatar} size="sm" /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.author_name}
            <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-brand">{p.kind}</span>
          </p>
          <p className="flex items-center gap-1 text-xs text-muted">{p.author_username ? `@${p.author_username}` : ''} \u00b7 {formatTime(p.created_at)} {visIcon(p.visibility)}</p>
        </div>
        {mine && (
          <div className="flex items-center gap-1">
            <Link to={`/posts/${p.id}/edit`} aria-label="Edit" className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={15} /></Link>
            <button aria-label="Delete" onClick={del} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-danger"><Trash2 size={15} /></button>
          </div>
        )}
      </div>
      <Link to={`/posts/${p.id}`} className="text-base font-bold leading-snug hover:text-brand">{p.title}</Link>
      {p.language_id && (
        <p><span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-muted">Written in {langName(p.language_id)}</span></p>
      )}
      <PostBody blocks={p.blocks} clamp />
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button onClick={read} disabled={busy} aria-label={p.has_read ? 'Mark as unread' : 'Mark as read'}
          className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition', p.has_read ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}>
          <Eye size={16} /> {eyeOpen || p.has_read ? p.read_count : ''}{!eyeOpen && !p.has_read ? 'Reads' : p.has_read ? 'Read' : ''}
        </button>
        <button onClick={save} aria-label="Save for reference" className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition', p.saved ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}>
          <Bookmark size={15} fill={p.saved ? 'currentColor' : 'none'} /> {p.saved ? 'Saved' : 'Save'}
        </button>
        <Link to={`/posts/${p.id}`} className="ml-auto text-sm font-semibold text-brand hover:underline">Open \u00b7 {p.notes_count} notes</Link>
      </div>
    </Card>
  );
}
