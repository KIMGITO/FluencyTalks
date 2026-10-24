import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Input, Spinner, Tabs } from '@/components/ui';
import { LanguageChip } from '@/components/features';
import { listSavedPartners, savePartner, deletePartner, type SavedPartner } from '@/services/library';
import { useProfileStore } from '@/store/profileStore';
import { usePartnersStore } from '@/store/partnersStore';
import { languageLabel } from '@/lib/languages';

const CATEGORY_LABELS: Record<string, string> = { phrase: 'Phrase', idiom: 'Idiom', usage: 'Usage', grammar: 'Grammar' };

export default function Partners() {
  const [tab, setTab] = useState<'saved' | 'browse'>('saved');
  const [partners, setPartners] = useState<SavedPartner[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);

  const languages = useProfileStore((s) => s.languages);
  const me = useProfileStore((s) => s.me);
  const myPartnersRef = usePartnersStore((s) => s.partners);
  const savedIds = useMemo(() => new Set(myPartnersRef.map((p) => p.partner_id)), [myPartnersRef]);

  const load = useCallback(async () => {
    setLoading(true);
    setSavingError(null);
    try {
      const data = await listSavedPartners();
      setPartners(data);
    } catch (e: any) {
      setSavingError(e.message || 'Failed to load partners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleSave = async (partnerId: string) => {
    setSavingError(null);
    setSaving(saving === partnerId ? null : partnerId);
    try {
      const isSaved = savedIds.has(partnerId);
      if (isSaved) {
        await deletePartner(partnerId);
        setPartners((prev) => prev?.filter((p) => p.partner_id !== partnerId) ?? null);
      } else {
        await savePartner(partnerId);
        setPartners((prev) => prev ? [...prev, { user_id: me?.id ?? '', partner_id: partnerId, created_at: new Date().toISOString() }] : null);
      }
    } catch (e: any) {
      setSavingError(e.message || 'Failed to update partner list.');
    } finally {
      setSaving(null);
    }
  };

  const isSaved = (id: string) => savedIds.has(id);

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <PageHeader title="Saved Partners" subtitle="Manage your language partner list" />

      <div className="mb-3 flex gap-2">
        <Tabs<'saved' | 'browse'> value={tab} onChange={setTab} items={[{ key: 'saved', label: 'Saved' }, { key: 'browse', label: 'Browse people' }]} />
      </div>

      {tab === 'saved' ? (
        <>
          {loading ? (
            <div className="flex justify-center p-8"><Spinner /></div>
          ) : !partners?.length ? (
            <EmptyState title="No saved partners yet" text="Save a language partner from the Browse tab to see them here." />
          ) : (
            <div className="space-y-2">{partners.map((p) => (
              <div key={p.partner_id} className="ft-card flex items-center justify-between rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <UserAvatar userId={p.partner_id} />
                  <span className="font-medium">{p.partner_id}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void toggleSave(p.partner_id)} data-save={isSaved(p.partner_id)}>{isSaved(p.partner_id) ? 'Saved' : 'Save'}</Button>
              </div>
            ))}</div>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">All languages</option>
              {languages.map((l) => <option key={l.language_id} value={l.language_id}>{languageLabel(l)}</option>)}
            </select>
            <Button variant="secondary" onClick={load}>Filter</Button>
          </div>
          <EmptyState title="No partners found" text="Try a broader search or different language." />
        </>
      )}
    </div>
  );
}

function UserAvatar({ userId }: { userId: string }) {
  return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 font-medium text-xs text-muted">{userId.slice(0, 2).toUpperCase()}</div>;
}
