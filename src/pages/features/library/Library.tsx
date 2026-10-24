import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Input, Spinner, Tabs } from '@/components/ui';
import { Cloud } from 'lucide-react';
import { listContributionPosts, isContributionEligible, savePartner, type ContributionPost } from '@/services/library';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

export default function Library() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'all' | 'my'>('all');
  const [posts, setPosts] = useState<ContributionPost[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);

  const languageName = useLanguageStore((s) => s.name);
  const languages = useLanguageStore((s) => s.list);
  const me = useProfileStore((s) => s.me);
  const myPartners = useProfileStore((s) => s.savedPartners);

  const query = params.get('q') ?? '';
  const lang = params.get('lang') ?? '';
  const cat = params.get('cat') ?? '';
  const sort = params.get('sort') ?? 'newest';

  const fetch = useCallback(async () => {
    setLoading(true);
    const p = { language_id: lang || undefined, category: cat || undefined };
    const r = await listContributionPosts(p.language_id ?? undefined, p.category ?? undefined);
    setPosts(r.posts ?? null);
    setTotal(r.total ?? 0);
    setLoading(false);
  }, [lang, cat]);

  useEffect(() => { void fetch(); }, [fetch]);

  const isMy = useMemo(() => tab === 'my', [tab]);

  const toggleSave = async (partnerId: string) => {
    setSavingError(null);
    setSaving(saving === partnerId ? null : partnerId);
    try {
      const isSaved = myPartners?.some((p) => p.partner_id === partnerId) ?? false;
      if (isSaved) {
        await savePartner(partnerId);
        setPosts((prev) => prev?.map((p) => (p.id === partnerId ? { ...p, saved: false } as ContributionPost : p)) as ContributionPost[] | null);
      } else {
        await savePartner(partnerId);
        setPosts((prev) => prev?.map((p) => (p.id === partnerId ? { ...p, saved: true } as ContributionPost : p)) as ContributionPost[] | null);
      }
    } catch (e: any) {
      setSavingError(e.message || 'Failed to update partner list.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <PageHeader title="Community Library" subtitle="Browse practiced phrases, idioms and usage examples contributed by the community" />

      <div className="mb-3 flex gap-2">
        <Tabs<'all' | 'my'> value={tab} onChange={setTab} items={[{ key: 'all', label: 'All' }, { key: 'my', label: 'My contributions' }]} />
        <Button variant="secondary" onClick={fetch} disabled={loading}>Refresh</Button>
      </div>

      <form className="mb-3 flex flex-wrap items-center gap-2" onChange={() => void fetch()}>
        <Input placeholder="Search the library…" value={query} name="q" className="flex-1 min-w-[180px]" />
        <select name="lang" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink">
          <option value="">All languages</option>
          {languages.map((l) => <option key={l.id} value={l.id}>{languageName(l.id)}</option>)}
        </select>
        <select name="cat" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink">
          <option value="">All categories</option>
          <option value="phrase">Phrases</option>
          <option value="idiom">Idioms</option>
          <option value="usage">Usage examples</option>
          <option value="grammar">Grammar</option>
        </select>
        <select name="sort" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <Button type="submit" variant="secondary">Apply</Button>
        {(query || lang || cat || sort) && (
          <Button type="button" variant="ghost" onClick={() => { setParams({}); void fetch(); }}>Clear</Button>
        )}
        {me && (
          <Button type="button" variant="primary" onClick={() => document.getElementById('contribution-modal')?.scrollIntoView({ behavior: 'smooth' })}>
            <Cloud size={16} className="mr-1" /> Contribute
          </Button>
        )}
      </form>

      {me && (
        <div id="contribution-modal" className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
          <span className={`h-2.5 w-2.5 rounded-full ${isContributionEligible(me) ? 'bg-success' : 'bg-danger'}`} />
          {isContributionEligible(me) ? 'You can contribute to the library.' : 'Join the library as a native speaker or B1+ learner.'}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8"><Spinner /></div>
      ) : !posts?.length ? (
        <EmptyState title="Nothing in the library yet" text="Be the first to share a phrase, idiom or usage example." action={me ? <Button onClick={() => document.getElementById('contribution-modal')?.scrollIntoView({ behavior: 'smooth' })}>Contribute</Button> : null} />
      ) : (
        <div className="space-y-3">{posts.map((p) => (
          <div key={p.id} className="ft-card space-y-2 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-lg">{p.phrase}</h3>
                {p.translation && <p className="mt-1 break-words text-muted">{p.translation}</p>}
                {p.source_context && <p className="mt-1 break-words text-xs text-muted">{p.source_context}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[11px] text-brand">{p.language_id}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{p.category}</span>
                  <span className="flex items-center gap-1"><UserAvatar userId={p.user_id} size="xs" /> {p.author?.display_name ?? 'Unknown'}</span>
                </div>
              </div>
              {me && (
                <Button variant="ghost" size="sm" onClick={() => void toggleSave(p.id)} data-save={myPartners?.some((pp) => pp.partner_id === p.id) ?? false}>{myPartners?.some((pp) => pp.partner_id === p.id) ? 'Saved' : 'Save'}</Button>
              )}
            </div>
          </div>
        ))}</div>
      )}

      {savingError && <p className="mt-3 text-sm text-danger">{savingError}</p>}
    </div>
  );
}

function UserAvatar({ userId, size = 'md' }: { userId: string; size?: 'xs' | 'sm' | 'md' }) {
  return <div className={`flex h-${size === 'xs' ? 6 : size === 'sm' ? 8 : 9} w-${size === 'xs' ? 6 : size === 'sm' ? 8 : 9} items-center justify-center rounded-full bg-surface-2 font-medium text-[11px] text-muted`}>{userId.slice(0, 2).toUpperCase()}</div>;
}
