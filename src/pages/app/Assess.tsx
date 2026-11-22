import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, Card, ErrorState, RowListSkeleton } from '@/components/ui';
import { AssessForm } from '@/components/features/call/AssessForm';
import { getTopicCall, type TopicCall } from '@/services/path';
import { REFUSALS } from '@/lib/refusals';

/** Rating a topic call later, from the notification. Right after the call, the same form is on the call's end screen. */
export default function Assess() {
  const { callId = '' } = useParams(); const nav = useNavigate();
  const [topic, setTopic] = useState<TopicCall | null | undefined>(undefined);
  const [done, setDone] = useState(false);
  useEffect(() => { getTopicCall(callId).then(setTopic).catch(() => setTopic(null)); }, [callId]);

  if (topic === undefined) return <RowListSkeleton label="Loading" />;
  if (!topic || topic.i_am !== 'partner') return <ErrorState title="This rating isn't available" />;
  if (done) return <Card><span className="ft-rule mb-2" aria-hidden /><h1 className="text-3xl">Thank you</h1><p className="mt-1 text-sm text-ink">Your rating counts toward their {topic.band} level. They see the averages and your comment, never your name next to a score.</p><Button className="mt-4" onClick={() => nav('/home')}>Back home</Button></Card>;
  if (topic.assess_blocker) return <ErrorState title={REFUSALS[`assessment_${topic.assess_blocker}`] ?? "This rating isn't available"} />;
  return (
    <>
      <PageHeader title="Rate the call" subtitle={`${topic.band} · ${topic.title}`} />
      <Card><AssessForm topic={topic} onDone={() => setDone(true)} /></Card>
    </>
  );
}
