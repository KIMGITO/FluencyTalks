import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, PhoneCall, Radio, Users, Video, type LucideIcon } from 'lucide-react';
import { getHomePulse, type HomePulse as Pulse } from '@/services/connections';
import { useLanguageStore } from '@/store/languageStore';

const REFRESH_MS = 60_000;

/**
 * The top of Home: how many people are here and talking, what calls are about right now, and the languages
 * people speak. Counts and topics only, never who is calling whom.
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

  return (
    <section aria-label="Happening now" className="ft-card mx-auto mb-4 w-full max-w-xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <span aria-hidden className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-go" />
        </span>
        <h2 className="font-display text-lg font-semibold text-ink">Happening now</h2>
        <span className="ml-auto text-xs text-muted">Live</span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Users} value={pulse.online} label="online" />
        <Stat icon={Video} value={pulse.live_calls} label={pulse.live_calls === 1 ? 'live call' : 'live calls'} accent />
        <Stat icon={PhoneCall} value={pulse.calls_today} label="calls today" />
      </div>

      {pulse.talking_about.length > 0 && (
        <Block icon={Radio} title="Talking about right now">
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {pulse.talking_about.map((t, i) => (
              <li key={`${t.no}:${i}`} className="flex shrink-0 items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-2.5 pr-3">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-sm font-semibold text-ink">{t.title}</span>
                <span className="text-xs text-muted">{t.band} · {name(t.language)}</span>
              </li>))}
          </ul>
        </Block>)}

      {pulse.popular_topics.length > 0 && (
        <Block icon={Flame} title="Popular this month">
          <ol className="space-y-1">
            {pulse.popular_topics.slice(0, 5).map((t, i) => (
              <li key={t.no} className="flex items-baseline gap-3 text-sm">
                <span className="w-4 shrink-0 text-right font-display font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t.title}</span>
                <span className="shrink-0 text-xs text-muted">{t.band}</span>
              </li>))}
          </ol>
        </Block>)}

      {pulse.languages.length > 0 && (
        <Block title="Languages spoken here">
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {pulse.languages.map((l) => {
              const total = l.natives + l.learners;
              return (
                <li key={l.id} className="w-36 shrink-0">
                  <Link to={`/people?lang=${l.id}`} className="block rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface-2">
                    <span className="block truncate text-sm font-semibold text-ink">{name(l.id)}</span>
                    {/* Native vs learning, as a split bar */}
                    <span aria-hidden className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="bg-brand" style={{ width: total ? `${(l.natives / total) * 100}%` : 0 }} />
                      <span className="bg-accent/60" style={{ width: total ? `${(l.learners / total) * 100}%` : 0 }} />
                    </span>
                    <span className="mt-1 block text-2xs text-muted">{l.natives} native · {l.learners} learning</span>
                  </Link>
                </li>);
            })}
          </ul>
        </Block>)}
    </section>
  );
}

function Stat({ icon: Icon, value, label, accent }: { icon: LucideIcon; value: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-3 text-center">
      <Icon size={16} aria-hidden className={accent ? 'mx-auto text-accent' : 'mx-auto text-brand'} />
      <p className="mt-1 font-display text-2xl font-bold leading-none text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function Block({ icon: Icon, title, children }: { icon?: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        {Icon && <Icon size={13} className="text-accent" aria-hidden />}{title}
      </p>
      {children}
    </div>
  );
}
