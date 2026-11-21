import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, ErrorState, RowListSkeleton, Textarea } from '@/components/ui';
import { CRITERIA, getTopicCall, submitTopicAssessment, type Scores, type TopicCall } from '@/services/path';
import { REFUSALS } from '@/lib/refusals';
import { userMessage } from '@/lib/errors';

const LEVELS = ['Not yet', 'Weak', 'Getting there', 'Good', 'Excellent'];

/** The partner's assessment after a topic call: five criteria from 1 to 5, and an optional comment the learner reads anonymously. */
export default function Assess() {
  const { callId = '' } = useParams(); const nav = useNavigate();
  const [topic, setTopic] = useState<TopicCall | null | undefined>(undefined);
  const [scores, setScores] = useState<Partial<Scores>>({});
  const [comment, setComment] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { getTopicCall(callId).then(setTopic).catch(() => setTopic(null)); }, [callId]);

  if (topic === undefined) return <RowListSkeleton label="Loading" />;
  if (!topic || topic.i_am !== 'partner') return <ErrorState title="This assessment isn't available" />;
  if (done) return <Card><span className="ft-rule mb-2" aria-hidden /><h1 className="text-3xl">Thank you</h1><p className="mt-1 text-sm text-ink">Your assessment counts toward topic {topic.topic}. The learner sees the averages and your comment, never your name next to a score.</p><Button className="mt-4" onClick={() => nav('/path')}>Back to my path</Button></Card>;
  if (topic.assess_blocker) return <ErrorState title={REFUSALS[`assessment_${topic.assess_blocker}`] ?? "This assessment isn't available"} />;

  const submit = async () => {
    setError('');
    if (CRITERIA.some((c) => !scores[c.key])) return setError('Give every criterion a score from 1 to 5.');
    setBusy(true);
    try { await submitTopicAssessment(callId, scores as Scores, comment.trim()); setDone(true); } catch (e) { setError(userMessage(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Assess the call" subtitle={`Topic ${topic.topic} · ${topic.band} · ${topic.title}`} />
      <Card>
        <p className="text-sm text-ink">Score what you heard, for a {topic.band} speaker. Be fair and honest: 4 out of 5 on average passes. Your scores are anonymous to them.</p>
        <div className="mt-4 space-y-5">
          {CRITERIA.map((c) => (
            <fieldset key={c.key}>
              <legend className="text-sm font-semibold text-ink">{c.label}</legend>
              <p className="text-xs text-muted">{c.hint}</p>
              <div className="mt-1.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${c.label}: ${n} of 5, ${LEVELS[n - 1]}`} aria-pressed={scores[c.key] === n}
                    onClick={() => setScores({ ...scores, [c.key]: n })} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-2">
                    <Star size={26} aria-hidden className={clsx((scores[c.key] ?? 0) >= n ? 'fill-accent text-accent' : 'text-border')} />
                  </button>))}
                <span className="ml-2 text-xs text-muted">{scores[c.key] ? LEVELS[scores[c.key]! - 1] : ''}</span>
              </div>
            </fieldset>))}
          <Textarea label="A comment for them (optional)" rows={3} maxLength={600} value={comment} placeholder="One thing they did well, and one thing to work on." onChange={(e) => setComment(e.target.value)} />
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button className="mt-4" full loading={busy} onClick={() => void submit()}>Send assessment</Button>
      </Card>
    </>
  );
}
