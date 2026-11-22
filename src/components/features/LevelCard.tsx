import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Lock, Phone, Star } from 'lucide-react';
import { Avatar, Button, Card, Notice, RowListSkeleton } from '@/components/ui';
import { TopicPicker } from '@/components/features/call/TopicPicker';
import { CRITERIA, getMyPath, listTopicPartners, type MyPath, type TopicPartner } from '@/services/path';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

/** Five red stars, filled to a percentage. */
export function Stars({ pct, size = 16 }: { pct: number | null; size?: number }) {
  const filled = pct == null ? 0 : Math.round(pct / 20);
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={pct == null ? 'No score yet' : `${pct}%`}>
      {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} aria-hidden className={i < filled ? 'fill-accent text-accent' : 'text-border'} />)}
    </span>
  );
}

/**
 * My level on my own profile: where I am from A1 to C2, how the current level is going, ratings I owe, and people I
 * can call. Any topic of the current level counts; a call starts after choosing one.
 */
export function LevelCard() {
  const [data, setData] = useState<MyPath | null>(null);
  const [partners, setPartners] = useState<TopicPartner[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [calling, setCalling] = useState<TopicPartner | null>(null);
  const languageName = useLanguageStore((s) => s.name);
  const me = useProfileStore((s) => s.me); const reload = useProfileStore((s) => s.load);
  const nav = useNavigate();
  const load = () => {
    setFailed(false);
    getMyPath().then((p) => {
      setData(p);
      if (me && p.verified_level !== (me.verified_level ?? null)) void reload(me.id);   // a pass changes rights
    }).catch(() => setFailed(true));
    listTopicPartners().then(setPartners).catch(() => setPartners([]));
  };
  useEffect(load, []);

  if (failed) return <Card><p className="text-sm text-muted">Couldn't load your level. <button type="button" className="text-brand underline" onClick={load}>Try again</button></p></Card>;
  if (!data) return <RowListSkeleton label="Loading your level" />;
  if (!data.language) return null;
  const s = data.settings; const c = data.current;

  return (
    <Card>
      <span className="ft-rule mb-2" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your level in {languageName(data.language)}</p>
      <ol className="mt-2 grid grid-cols-6 gap-1" aria-label="Levels A1 to C2">
        {data.levels.map((l) => (
          <li key={l.band} className={clsx('flex flex-col items-center gap-0.5 rounded-md py-1.5 text-xs font-bold',
            l.state === 'passed' ? 'bg-brand text-on-brand' : l.band === data.current_band ? 'bg-accent text-on-brand' : 'bg-surface-2 text-muted')}>
            <span>{l.band}</span>
            <span aria-label={l.state === 'passed' ? 'passed' : l.state === 'locked' ? 'locked' : l.band === data.current_band ? 'current' : l.state}>
              {l.state === 'passed' ? <Check size={13} aria-hidden /> : l.state === 'locked' ? <Lock size={12} aria-hidden /> : <span className="text-[0.65rem] font-semibold">now</span>}
            </span>
          </li>))}
      </ol>

      {c ? (
        <>
          <h2 className="mt-4 text-2xl text-brand">Working on {c.band}</h2>
          <p className="text-sm text-ink">{c.goal}</p>
          <p className="mt-1 text-xs text-muted">Talk about any {c.band} topic for at least {s.min_call_minutes} minutes. Each partner rates you once for this level: {s.partners_needed} different people and {s.pass_pct}% overall passes it.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Partners</p>
              <p className="font-display text-3xl font-extrabold italic text-ink">{Math.min(c.counting, s.partners_needed)}<span className="text-lg text-muted"> / {s.partners_needed}</span></p>
              {c.waiting > 0 && <p className="text-xs text-muted">{c.waiting} more count once their accounts are {s.settle_days} days old.</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Score · {s.pass_pct}% to pass</p>
              <p className="font-display text-3xl font-extrabold italic text-ink">{c.score_pct == null ? '–' : `${Math.round(c.score_pct)}%`}</p>
              <Stars pct={c.score_pct} />
            </div>
          </div>
          {c.counting >= s.partners_needed && (c.score_pct ?? 0) < s.pass_pct && (
            <Notice small className="mt-3">Your score is cumulative: talk with more people at this level and each new rating lifts the average.</Notice>)}
          {c.criteria.fluency != null && (
            <ul className="mt-3 space-y-1 text-sm">
              {CRITERIA.map((k) => <li key={k.key} className="flex justify-between gap-2"><span className="text-ink">{k.label}</span><span className="text-muted">{c.criteria[k.key]} / 5</span></li>)}
            </ul>)}
          {c.comments.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted">What partners said</p>
              {c.comments.slice(0, 3).map((x) => <blockquote key={x.created_at} className="border-l-2 border-brand pl-3 text-sm italic text-ink">“{x.comment}”</blockquote>)}
            </div>)}

          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-lg">Call someone at your level</h3>
            <p className="text-xs text-muted">A native speaker, or someone who passed a higher level. Add them as a partner or chat first.</p>
            {partners === null ? <RowListSkeleton label="Loading partners" /> : partners.length === 0
              ? <p className="mt-2 text-sm text-ink">No one you can call can rate {c.band} yet. <button type="button" className="text-brand underline" onClick={() => nav('/people')}>Find native speakers</button> and add them as partners.</p>
              : <ul className="mt-2 space-y-2">{partners.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Avatar name={p.display_name ?? p.username ?? '?'} src={p.avatar_url} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm"><strong>{p.display_name ?? p.username}</strong> <span className="text-muted">· {p.basis === 'native' ? 'native speaker' : 'passed higher'}</span></span>
                    <Button size="sm" onClick={() => setCalling(p)}><Phone size={14} aria-hidden />Call</Button>
                  </li>))}</ul>}
          </div>
        </>
      ) : <><h2 className="mt-4 text-2xl">Every level passed</h2><p className="text-sm text-ink">You've passed C2. Remarkable.</p></>}

      {data.owed.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-lg">Ratings you owe</h3>
          <ul className="mt-2 space-y-2">
            {data.owed.map((o) => (
              <li key={o.call_id} className="flex items-center gap-3">
                <Avatar name={o.learner_name ?? o.learner_username ?? '?'} src={o.learner_avatar} size="sm" />
                <span className="min-w-0 flex-1 text-sm"><strong>{o.learner_name ?? o.learner_username}</strong> · {o.band}, {o.title}<span className="block text-xs text-muted">Due {new Date(o.due_at).toLocaleDateString()}</span></span>
                <Button size="sm" onClick={() => nav(`/path/assess/${o.call_id}`)}>Rate</Button>
              </li>))}
          </ul>
        </div>)}

      <TopicPicker open={!!calling} band={data.current_band} title={`What will you talk about with ${calling?.display_name ?? calling?.username ?? 'them'}?`}
        onClose={() => setCalling(null)}
        onPick={(t) => calling && nav(`/call/new?to=${calling.id}&topic=${t.no}`, { state: { name: calling.display_name ?? calling.username, avatar: calling.avatar_url } })} />
    </Card>
  );
}
