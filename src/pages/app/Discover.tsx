import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { ProfileCard } from '@/components/features';
import { Button, EmptyState, Input, Select, Spinner } from '@/components/ui';
import { DISCOVER_PAGE_SIZE, LEARNER_LEVELS } from '@/lib/constants';
import { searchPeople } from '@/services';
import { useLanguageStore } from '@/store/languageStore';
import type { Person } from '@/types/db';

export default function Discover() {
  const [params] = useSearchParams(); const languages = useLanguageStore((s) => s.list);
  const [query, setQuery] = useState(params.get('q') ?? ''); const [language, setLanguage] = useState(''); const [role, setRole] = useState(''); const [level, setLevel] = useState('');
  const [people, setPeople] = useState<Person[]>([]); const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [error, setError] = useState('');

  const run = useCallback(async (offset: number) => {
    setLoading(true); setError('');
    try {
      const rows = await searchPeople({ query: query || undefined, language: language || undefined, role: role || undefined, level: level || undefined, offset });
      setPeople((p) => (offset ? [...p, ...rows] : rows)); setMore(rows.length === DISCOVER_PAGE_SIZE);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [query, language, role, level]);

  useEffect(() => { setQuery(params.get('q') ?? ''); }, [params]);
  useEffect(() => { const t = setTimeout(() => run(0), 300); return () => clearTimeout(t); }, [run]);

  return (
    <>
      <PageHeader title="Discover" subtitle="Find people to practice with" />
      {/* Filters wrap as a flex row — no grid needed at any width, and each
          control grows to share the line instead of forcing a fixed column. */}
      <div className="ft-card ft-card-pad mb-3 flex flex-wrap gap-1.5">
        <div className="min-w-[10rem] flex-[2_1_10rem]"><Input aria-label="Search" placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="min-w-[8rem] flex-1"><Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="">Any language</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></div>
        <div className="min-w-[8rem] flex-1"><Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="">Native or learning</option><option value="native">Native speakers</option><option value="learning">Learners</option></Select></div>
        <div className="min-w-[6rem] flex-1"><Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Any level</option>{LEARNER_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></div>
      </div>
      {error && <p className="mb-3 text-danger">{error}</p>}
      <div className="flex flex-col gap-2">{people.map((p) => <ProfileCard key={p.id} person={p} onHidden={(id) => setPeople((l) => l.filter((x) => x.id !== id))} />)}</div>
      {loading && <div className="flex justify-center p-6"><Spinner /></div>}
      {!loading && !people.length && !error && <EmptyState title="No one matches yet" text="Try removing a filter or searching a different language." />}
      {!loading && more && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => run(people.length)}>Show more</Button></div>}
    </>
  );
}
