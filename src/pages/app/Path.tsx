import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Lock, Phone, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, Card, EmptyState, ErrorState, RowListSkeleton, Notice } from '@/components/ui';
import { CRITERIA, getMyPath, listTopicPartners, type MyPath, type PathTopic, type TopicPartner } from '@/services/path';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Five red stars, filled to a percentage: the rating look of the reference design, in flat colour. */
export function Stars({ pct, size = 16 }: { pct: number | null; size?: number }) {
  const filled = pct == null ? 0 : Math.round(pct / 20);
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={pct == null ? 'No score yet' : `${pct}%`}>
      {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} aria-hidden className={i < filled ? 'fill-accent text-accent' : 'text-border'} />)}
    </span>
  );
}

/** The 25 topics from A1 to C2: where I am, what the current topic needs, and who I can call for it. */
export default function Path() {
  const [data, setData] = useState<MyPath | null>(null);
  const [partners, setPartners] = useState<TopicPartner[] | null>(null);
  const [failed, setFailed] = useState(false);
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

  if (failed) return <ErrorState title="Couldn't load your path" onRetry={load} />;
  if (!data) return <RowListSkeleton label="Loading your path" />;
  if (!data.language) return <EmptyState title="Choose a language to learn" text="Your path starts once you add the language you're learning to your profile." action={<Link to="/profile/edit" className="text-brand underline">Edit profile</Link>} />;

  const s = data.settings;
  const cur = data.topics.find((t) => t.no === data.current_topic) ?? null;
  const c = data.current;

  return (
    <>
      <PageHeader title="Your path" subtitle={`25 conversation topics in ${languageName(data.language)}, from A1 to C2.`} />

      {data.owed.length > 0 && (
        <Card className="mb-4 border-l-4 border-accent">
          <h2 className="text-xl">Assessments you owe</h2>
          <ul className="mt-2 space-y-2">
            {data.owed.map((o) => (
              <li key={o.call_id} className="flex items-center gap-3">
                <Avatar name={o.learner_name ?? o.learner_username ?? '?'} src={o.learner_avatar} size="sm" />
                <span className="min-w-0 flex-1 text-sm"><strong>{o.learner_name ?? o.learner_username}</strong> · topic {o.topic}, {o.title}<span className="block text-xs text-muted">Due {new Date(o.due_at).toLocaleDateString()}</span></span>
                <Button size="sm" onClick={() => nav(`/path/assess/${o.call_id}`)}>Assess</Button>
              </li>))}
          </ul>
        </Card>)}

      {cur && c ? (
        <Card className="mb-6">
          <span className="ft-rule mb-2" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Now · Topic {cur.no} of 25 · {cur.band}</p>
          <h2 className="mt-1 text-3xl text-brand">{cur.title}</h2>
          <p className="mt-1 text-sm text-ink">{cur.summary}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink">{cur.prompts.map((p) => <li key={p}>{p}</li>)}</ol>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
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
            <Notice small className="mt-3">Your score is cumulative: talk with more people about this topic and each new assessment lifts the average.</Notice>)}

          {c.criteria.fluency != null && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {CRITERIA.map((k) => (
                <li key={k.key} className="flex items-center justify-between gap-2"><span className="text-ink">{k.label}</span><span className="text-muted">{c.criteria[k.key]} / 5</span></li>))}
            </ul>)}
          {c.comments.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted">What partners said</p>
              {c.comments.map((x) => <blockquote key={x.created_at} className="border-l-2 border-brand pl-3 text-sm italic text-ink">“{x.comment}”</blockquote>)}
            </div>)}

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-lg">Call someone about this topic</h3>
            <p className="text-xs text-muted">A native speaker, or someone who passed a topic at a higher level. You need to have chatted with them first. Talk for at least {s.min_call_minutes} minutes; afterwards they score you on five points.</p>
            {partners === null ? <RowListSkeleton label="Loading partners" /> : partners.length === 0
              ? <p className="mt-2 text-sm text-ink">No one you chat with can assess this topic yet. <Link className="text-brand underline" to="/search?tab=people">Find native speakers</Link> and say hello first.</p>
              : <ul className="mt-2 space-y-2">{partners.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Avatar name={p.display_name ?? p.username ?? '?'} src={p.avatar_url} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm"><strong>{p.display_name ?? p.username}</strong> <span className="text-muted">· {p.basis === 'native' ? 'native speaker' : 'passed higher'}</span></span>
                    <Button size="sm" onClick={() => nav(`/call/new?to=${p.id}&topic=1`, { state: { name: p.display_name ?? p.username, avatar: p.avatar_url } })}><Phone size={14} />Call</Button>
                  </li>))}</ul>}
          </div>
        </Card>
      ) : <Card className="mb-6"><h2 className="text-3xl">Path complete</h2><p className="text-sm text-ink">You've passed all 25 topics. Remarkable.</p></Card>}

      {BANDS.map((band) => (
        <section key={band} className="mb-5">
          <h2 className="mb-2 flex items-baseline gap-2 text-2xl">{band}{data.verified_level === band && <span className="font-sans text-xs font-semibold normal-case not-italic text-accent">your level</span>}</h2>
          <ol className="space-y-1.5">{data.topics.filter((t) => t.band === band).map((t) => <TopicRow key={t.no} t={t} current={t.no === data.current_topic} />)}</ol>
        </section>))}
    </>
  );
}

function TopicRow({ t, current }: { t: PathTopic; current: boolean }) {
  return (
    <li className={clsx('ft-card flex items-center gap-3 p-3', current && 'border-l-4 border-accent', (t.state === 'locked' || t.state === 'skipped') && 'opacity-70')}>
      <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold italic',
        t.state === 'passed' ? 'bg-brand text-on-brand' : current ? 'bg-accent text-on-brand' : 'bg-surface-2 text-muted')}>
        {t.state === 'passed' ? <Check size={16} aria-hidden /> : t.state === 'locked' ? <Lock size={14} aria-hidden /> : t.no}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{t.no}. {t.title}</span>
        <span className="block truncate text-xs text-muted">{t.state === 'skipped' ? 'Placed above this at sign-up' : t.summary}</span>
      </span>
      {t.state === 'passed' && <Stars pct={t.score_pct} size={12} />}
    </li>
  );
}
