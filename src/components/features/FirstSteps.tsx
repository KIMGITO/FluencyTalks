import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLevelProgress, type LevelProgress } from '@/services/levels';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';

const read = (key: string) => { try { return !!localStorage.getItem(key); } catch { return false; } };
const remember = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* it just shows again next time */ } };

/** A first visit can feel empty: this says what to do first, and shows it's working. Goes away once done or dismissed. */
export function FirstSteps() {
  const me = useProfileStore((s) => s.me);
  const languageName = useLanguageStore((s) => s.name);
  const key = `ft-first-steps:${me?.id}`;
  const [closed, setClosed] = useState(() => read(key));
  const [progress, setProgress] = useState<LevelProgress | null>(null);

  useEffect(() => {
    if (!me || closed) return;
    let live = true;
    getLevelProgress().then((p) => { if (live) setProgress(p); }).catch(() => undefined);
    return () => { live = false; };
  }, [me?.id, closed]);

  if (!me || closed || !progress) return null;
  const learning = me.learning_language_id ? languageName(me.learning_language_id) : null;
  const n = progress.needs;
  const toFirstLevel = progress.next_level === 'A1' && n ? `${Math.min(progress.evidence?.messages ?? 0, n.min_messages)} of ${n.min_messages} done.` : '';
  const steps = [
    { done: progress.contribution.posts > 0, to: '/library/contribute', title: learning ? `Write your first post in ${learning}` : 'Share your first post', text: learning ? 'A few words is enough, and mistakes are welcome. Native speakers are told so they can help.' : 'Teach something from your language, or ask a question.' },
    { done: progress.conversations > 0, to: '/search?tab=people', title: 'Say hello to someone', text: 'Find someone who speaks what you want to practise.' },
    ...(learning ? [{ done: !!progress.verified_level, to: '/profile/edit', title: 'Earn your first level', text: `Write 5 different messages or posts in ${learning}. ${toFirstLevel}` }] : []),
  ];
  const left = steps.filter((s) => !s.done).length;
  if (!left) { remember(key); return null; }
  const next = steps.find((s) => !s.done);

  return (
    <section aria-label="Your first steps" className="ft-card mb-4 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Your first steps: {steps.length - left} of {steps.length} done</h2>
        <button type="button" aria-label="Hide first steps" onClick={() => { remember(key); setClosed(true); }} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><X size={16} aria-hidden /></button>
      </div>
      <ul className="mt-1 space-y-1">
        {steps.map((s) => (
          <li key={s.title}>
            <Link to={s.to} className="flex items-start gap-2.5 rounded-md p-2 hover:bg-surface-2">
              <span className={s.done ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-surface' : 'mt-0.5 h-5 w-5 shrink-0 rounded-full border border-border'}>
                {s.done && <Check size={13} aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className={s.done ? 'block text-sm text-muted line-through' : 'block text-sm font-semibold text-ink'}>{s.title}</span>
                {s === next && <span className="block text-xs text-muted">{s.text}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
