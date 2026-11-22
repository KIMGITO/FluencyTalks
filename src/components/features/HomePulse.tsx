import { useEffect, useState } from 'react';
import { Flame, Radio } from 'lucide-react';
import { getHomePulse, type HomePulse as Pulse } from '@/services/connections';
import { useLanguageStore } from '@/store/languageStore';

const REFRESH_MS = 60_000;

/**
 * On Home, at the top of the right-hand column on wide screens: how many people are here and talking, and what calls
 * are about. Counts and topics only, never who is calling whom.
 */
export function HomePulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const languageName = useLanguageStore((s) => s.name);
  useEffect(() => {
    let live = true;
    const load = () => { if (!document.hidden) getHomePulse().then((p) => { if (live) setPulse(p); }).catch(() => undefined); };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!pulse) return null;
  const name = (id: string) => languageName(id) ?? id;
  // Live topics if there are any, otherwise what has been popular.
  const live = pulse.talking_about.length > 0;
  const topics = live
    ? pulse.talking_about.slice(0, 5).map((t, i) => ({ key: `${t.no}:${i}`, title: t.title, note: `${t.band} · ${name(t.language)}` }))
    : pulse.popular_topics.slice(0, 5).map((t) => ({ key: String(t.no), title: t.title, note: t.band }));

  return (
    <section aria-label="Happening now" className="space-y-3 px-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-go" />
        </span>
        Happening now
      </h2>
      <dl className="flex gap-4 text-sm">
        <Stat value={pulse.online} label="online" />
        <Stat value={pulse.live_calls} label={pulse.live_calls === 1 ? 'live call' : 'live calls'} />
        <Stat value={pulse.calls_today} label="today" />
      </dl>
      {topics.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
            {live ? <Radio size={13} className="text-accent" aria-hidden /> : <Flame size={13} className="text-accent" aria-hidden />}
            {live ? 'Talking about' : 'Popular this month'}
          </p>
          <ul className="space-y-1">
            {topics.map((t) => (
              <li key={t.key} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t.title}</span>
                <span className="shrink-0 text-xs text-muted">{t.note}</span>
              </li>))}
          </ul>
        </div>)}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dd className="font-display text-lg font-bold leading-none text-ink">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
