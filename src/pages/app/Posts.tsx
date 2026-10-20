import { Link } from 'react-router-dom';
import { BookOpenText, PenLine } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { PostCard, SavedPostCard } from '@/components/features/posts';
import { listPosts } from '@/services/posts';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { rankPosts } from '@/lib/feedScore';
import type { Post } from '@/types/posts';
import { useEffect, useMemo, useState } from 'react';

type Tab = 'all' | 'blog' | 'story' | 'mine' | 'saved';

export default function Posts() {
  const [tab, setTab] = useState<Tab>('all');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const me = useProfileStore((s) => s.me);
  const languages = useProfileStore((s) => s.languages);
  const uid = useAuthStore((s) => s.user?.id);
  const staff = me?.role === 'admin' || me?.role === 'moderator';
  useEffect(() => {
    setPosts(null);
    listPosts({ kind: tab === 'all' ? 'all' : tab === 'mine' ? undefined : tab === 'saved' ? undefined : tab, mine: tab === 'mine', saved: tab === 'saved' })
      .then(setPosts).catch(() => setPosts([]));
  }, [tab]);
  const patch = (n: Post) => setPosts((ps) => (ps ?? []).map((x) => (x.id === n.id ? n : x)));
  const drop = (id: string) => setPosts((ps) => (ps ?? []).filter((x) => x.id !== id));
  const ranked = useMemo(() => rankPosts(posts ?? [], {
    learning: languages.filter((l: { language_id: string; role: string }) => l.role === 'learning').map((l: { language_id: string; role: string }) => l.language_id) ?? [],
    native: languages.filter((l: { language_id: string; role: string }) => l.role === 'native').map((l: { language_id: string; role: string }) => l.language_id) ?? [],
    country: me?.country_code ?? null,
    timezone: me?.timezone ?? null,
  }), [posts, languages, me]);
  const show = tab === 'all' ? ranked : ranked.filter((p) => tab === 'mine' ? p.author_id === uid : tab === 'saved' ? p.saved : p.kind === tab);
  return (
    <>
      <PageHeader title="Stories & Blog" subtitle="Learn languages through real stories. Tap the eye when you have read one." />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex flex-wrap gap-2">
          {(['all', 'blog', 'story', 'mine', 'saved'] as Tab[]).map((k) => {
            const active = tab === k;
            const cls = active
              ? 'bg-brand-soft text-brand'
              : 'text-muted hover:bg-surface-2';
            return (
              <button key={k} role="tab" aria-selected={active} onClick={() => setTab(k)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${cls}`}>
                {k === 'all' ? 'All' : k === 'mine' ? 'Mine' : k === 'saved' ? 'Saved' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5">
          <Link to="/posts/new?type=story"><Button size="sm" variant="secondary"><PenLine size={14} /> Write story</Button></Link>
          {staff && <Link to="/posts/new?type=blog"><Button size="sm"><BookOpenText size={14} /> New blog</Button></Link>}
        </div>
      </div>
      {!posts ? <div className="flex justify-center p-8"><Spinner /></div>
      : !show.length ? <EmptyState title={tab === 'saved' ? 'Nothing saved yet' : tab === 'mine' ? 'You have not written anything yet' : 'No posts yet'} text={tab === 'saved' ? 'Tap Save on any story or blog to keep it here for reference.' : 'Be the first to share a story in the language you are learning.'} />
      : <div className="flex flex-col gap-2">{show.map((p) => {
        const isMine = !!uid && (p.author_id === uid || !!staff);
        return tab === 'saved' ? (
          <SavedPostCard key={p.id} post={p} onRemoved={drop} />
        ) : (
          <PostCard key={p.id} post={p} mine={isMine} onChanged={patch} onDeleted={drop} />
        );
      })}</div>}
    </>
  );
}
