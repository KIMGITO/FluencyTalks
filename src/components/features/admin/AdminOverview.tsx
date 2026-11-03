import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, Ban, Bug, CircleCheck, CirclePause, Clock, FileText, Flag, MessageCircle, PauseOctagon, Scale, UserCheck, Users, type LucideIcon } from 'lucide-react';
import { Card, ErrorState, RowListSkeleton, buttonClass } from '@/components/ui';
import { HELLOS } from '@/components/landing/greetings';
import { useAction } from '@/hooks/useAction';
import { formatTime } from '@/lib/format';
import type { StaffTier } from '@/services/admin';
import { useAdminStore } from '@/store/adminStore';
import { useProfileStore } from '@/store/profileStore';
import { IconTile, StatTile, type Tone } from './AdminKit';
import { SiteStatusPanel } from './SiteStatusPanel';

interface Todo { to: string; count: number; text: string; note?: string; icon: LucideIcon; tone: Tone }
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A different hello each day, from the same list as the home page. */
function Hero({ name, todo }: { name?: string | null; todo: Todo[] }) {
  const day = Math.floor(Date.now() / 864e5);
  const [word, lang, , dir] = HELLOS[day % HELLOS.length] as [string, string, number, ('rtl' | undefined)?];
  const waiting = todo.reduce((n, t) => n + t.count, 0);
  const others = Array.from({ length: 7 }, (_, i) => HELLOS[(day + i + 1) % HELLOS.length]);
  return (
    <section className="relative overflow-hidden bg-deep px-4 py-6 text-on-deep md:rounded-lg md:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 flex-wrap content-center justify-end gap-x-5 gap-y-1 pr-6 font-display text-3xl text-on-deep/[0.09] sm:flex">
        {others.map(([w]) => <span key={w as string}>{w}</span>)}
      </div>
      <div className="relative max-w-xl">
        <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-on-deep/70"><span aria-hidden className="h-px w-5 bg-accent" />{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="mt-2 font-display text-3xl font-medium leading-tight md:text-4xl"><span lang={lang} dir={dir}>{word}</span>{name && `, ${name}`}</h1>
        <p className="mt-2 text-on-deep/80">{waiting ? <><b className="text-accent tabular-nums">{waiting}</b> {plural(waiting, 'thing is', 'things are')} waiting for you today.</> : 'Nothing is waiting for you. The community is in good hands.'}</p>
        {todo[0] && <Link to={todo[0].to} className={`${buttonClass('primary', 'sm')} mt-4`}>Start with {todo[0].to === '/admin/logs' ? 'the logs' : todo[0].to === '/admin/reports' ? 'reports' : 'decisions'} <ArrowRight size={16} aria-hidden /></Link>}
      </div>
    </section>
  );
}

const Heading = ({ id, children }: { id: string; children: string }) => <h2 id={id} className="ft-inset font-display text-xl font-medium">{children}</h2>;

export function AdminOverviewPage() {
  const tier = useOutletContext<StaffTier>();
  const { overview: data, failed, refresh } = useAdminStore();
  const me = useProfileStore((s) => s.me);
  const retry = useAction(refresh, { silent: true });
  if (failed && !data) return <ErrorState title="Couldn't load the overview" onRetry={() => void retry.run()} busy={retry.busy} />;
  if (!data) return <RowListSkeleton label="Loading the overview" />;
  const todo: Todo[] = ([
    { to: '/admin/reports', count: data.reports_open, text: plural(data.reports_open, 'report to decide', 'reports to decide'), note: data.reports_oldest_open ? `Oldest from ${formatTime(data.reports_oldest_open)}` : undefined, icon: Flag, tone: 'accent' },
    { to: '/admin/decisions', count: data.appeals_open, text: plural(data.appeals_open, 'appeal to answer', 'appeals to answer'), icon: Scale, tone: 'sun' },
    { to: '/admin/decisions', count: data.decisions_escalated, text: plural(data.decisions_escalated, 'escalated decision', 'escalated decisions'), icon: Clock, tone: 'danger' },
    // Moderators can't open the logs, so a link there would only dead-end.
    ...(tier === 'moderator' ? [] : [{ to: '/admin/logs', count: data.errors_24h, text: plural(data.errors_24h, 'application error today', 'application errors today'), icon: Bug, tone: 'danger' as Tone }]),
  ] as Todo[]).filter((t) => t.count > 0);
  const activePct = data.users_total ? (100 * data.users_active_24h) / data.users_total : 0;
  return (
    <div className="space-y-6">
      <Hero name={me?.display_name} todo={todo} />
      {tier !== 'moderator' && <SiteStatusPanel />}
      <section aria-labelledby="needs-you" className="space-y-2">
        <Heading id="needs-you">Needs you</Heading>
        {!todo.length ? (
          <Card className="flex items-center gap-3 text-sm"><IconTile icon={CircleCheck} tone="success" /> <span><b className="block">All clear</b><span className="text-muted">No reports, appeals or escalations are waiting.</span></span></Card>
        ) : (
          <div className="grid gap-3 px-3 sm:grid-cols-2 md:px-0">
            {todo.map((t, i) => (
              <Link key={t.text} to={t.to} style={{ animationDelay: `${i * 50}ms` }} className="ft-card ft-card-pad ft-lift ft-rise group flex items-center gap-3 !rounded-lg !border">
                <IconTile icon={t.icon} tone={t.tone} />
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-baseline gap-x-2"><b className="font-display text-2xl font-medium tabular-nums">{t.count}</b> <span className="text-sm font-semibold">{t.text}</span></span>{t.note && <span className="block text-xs text-muted">{t.note}</span>}</span>
                <ArrowRight size={18} aria-hidden className="shrink-0 text-muted transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="community" className="space-y-2">
        <Heading id="community">Community</Heading>
        <div className="grid grid-cols-2 gap-3 px-3 md:px-0 lg:grid-cols-4">
          <StatTile label="People" value={data.users_total} hint={`${data.users_new_7d.toLocaleString()} new this week`} icon={Users} tone="brand" to="/admin/people" />
          <StatTile label="Active today" value={data.users_active_24h} hint={`${Math.round(activePct)}% of everyone`} icon={UserCheck} tone="aqua" meter={{ percent: activePct, label: 'Share of people active today' }} delay={50} />
          <StatTile label="Messages today" value={data.messages_24h} icon={MessageCircle} tone="sun" delay={100} />
          <StatTile label="Posts this week" value={data.posts_7d} icon={FileText} tone="accent" delay={150} />
        </div>
      </section>
      <section aria-labelledby="safety" className="space-y-2">
        <Heading id="safety">Safety</Heading>
        <div className="grid grid-cols-2 gap-3 px-3 md:px-0 lg:grid-cols-4">
          <StatTile label="Open reports" value={data.reports_open} icon={Flag} tone={data.reports_open ? 'accent' : 'muted'} to="/admin/reports" />
          <StatTile label="Suspended" value={data.users_suspended} icon={CirclePause} tone={data.users_suspended ? 'sun' : 'muted'} to="/admin/people?status=suspended" delay={50} />
          <StatTile label="Banned" value={data.users_banned} icon={Ban} tone={data.users_banned ? 'danger' : 'muted'} to="/admin/people?status=banned" delay={100} />
          <StatTile label="Posting paused" value={data.restrictions_active} icon={PauseOctagon} tone={data.restrictions_active ? 'sun' : 'muted'} to="/admin/decisions" delay={150} />
        </div>
      </section>
    </div>
  );
}
