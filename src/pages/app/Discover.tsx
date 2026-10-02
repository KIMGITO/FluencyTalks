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
      <div className="ft-card mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input aria-label="Search" placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="">Any language</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
        <Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="">Native or learning</option><option value="native">Native speakers</option><option value="learning">Learners</option></Select>
        <Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Any level</option>{LEARNER_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>
      </div>
      {error && <p className="mb-3 text-danger">{error}</p>}
      <div className="grid gap-4 xl:grid-cols-2">{people.map((p) => <ProfileCard key={p.id} person={p} onHidden={(id) => setPeople((l) => l.filter((x) => x.id !== id))} />)}</div>
      {loading && <div className="flex justify-center p-6"><Spinner /></div>}
      {!loading && !people.length && !error && <EmptyState title="No one matches yet" text="Try removing a filter or searching a different language." />}
      {!loading && more && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => run(people.length)}>Show more</Button></div>}
    </>
  );
}
