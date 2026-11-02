import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button, Card, ErrorState, RowListSkeleton } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminSystemHealth, probeHealth, type HealthProbe, type SystemHealth } from '@/services/admin';

type Level = 'ok' | 'warn' | 'bad';
const ICON = { ok: CircleCheck, warn: TriangleAlert, bad: CircleX };
const TONE = { ok: 'text-success', warn: 'text-accent', bad: 'text-danger' };
const Row = ({ label, value, level }: { label: string; value: string; level?: Level }) => {
  const Icon = level && ICON[level];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2 text-sm first:pt-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1.5 font-semibold tabular-nums">{Icon && <Icon size={16} aria-hidden className={TONE[level!]} />}{value}</span>
    </div>
  );
};
const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <Card className="space-y-2">
    <h2 className="font-semibold">{title}</h2>
    {note && <p className="text-xs text-muted">{note}</p>}
    <div className="divide-y divide-border">{children}</div>
  </Card>
);
const bytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
const since = (iso: string) => { const h = (Date.now() - new Date(iso).getTime()) / 36e5; return h >= 48 ? `${Math.floor(h / 24)} days` : h >= 1 ? `${Math.floor(h)} hours` : `${Math.max(1, Math.floor(h * 60))} minutes`; };
const uptimeLevel = (p: number | null): Level | undefined => (p === null ? undefined : p >= 99.5 ? 'ok' : p >= 95 ? 'warn' : 'bad');
const pct = (p: number | null) => (p === null ? 'No data yet' : `${p}%`);

export function AdminHealth() {
  const [data, setData] = useState<SystemHealth | null>(null); const [probe, setProbe] = useState<HealthProbe | null>(null);
  const [probeFailed, setProbeFailed] = useState(false); const [failed, setFailed] = useState(false); const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    await Promise.all([
      adminSystemHealth().then((d) => { setData(d); setFailed(false); }).catch(() => setFailed(true)),
      probeHealth().then((p) => { setProbe(p); setProbeFailed(false); }).catch(() => setProbeFailed(true)),
    ]);
    setBusy(false);
  };
  useEffect(() => { void load(); }, []);
  if (failed && !data) return <ErrorState title="Couldn't load system health" onRetry={() => void load()} busy={busy} />;
  if (!data) return <RowListSkeleton label="Loading system health" />;
  const { database: db, uptime, security: sec } = data;
  const connPct = Math.round((100 * db.connections) / db.max_connections);
  const beatAge = uptime.last_beat ? (Date.now() - new Date(uptime.last_beat).getTime()) / 60000 : null;
  return (
    <div className="space-y-4">
      <div className="ft-inset flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Checked {formatTime(data.checked_at)}</p>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => void load()}><RefreshCw size={14} aria-hidden /> Check again</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Services" note="Asked from an edge function just now.">
          {probeFailed ? <Row label="Edge functions" value="Not answering" level="bad" />
            : !probe ? <Row label="Edge functions" value="Checking…" />
            : <>
              {probe.services.map((s) => <Row key={s.name} label={s.name} value={s.ok ? (s.ms ? `Up · ${s.ms} ms` : 'Up') : `Down${s.status ? ` · ${s.status}` : ''}`} level={s.ok ? 'ok' : 'bad'} />)}
              <Row label="Web push keys" value={probe.secrets.web_push ? 'Set' : 'Not set'} level={probe.secrets.web_push ? 'ok' : 'warn'} />
              <Row label="Unsplash key" value={probe.secrets.unsplash ? 'Set' : 'Not set'} level={probe.secrets.unsplash ? 'ok' : 'warn'} />
            </>}
        </Section>
        <Section title="Uptime" note="From a once-a-minute database heartbeat, so this covers the database and its scheduler, not the website. Use an outside monitor for that (docs/ADMIN_SETUP.md).">
          <Row label="Last 24 hours" value={pct(uptime.d1)} level={uptimeLevel(uptime.d1)} />
          <Row label="Last 7 days" value={pct(uptime.d7)} level={uptimeLevel(uptime.d7)} />
          <Row label="Last 30 days" value={pct(uptime.d30)} level={uptimeLevel(uptime.d30)} />
          <Row label="Last heartbeat" value={uptime.last_beat ? formatTime(uptime.last_beat) : 'Never: pg_cron is not running'} level={beatAge === null || beatAge > 5 ? 'bad' : 'ok'} />
          <Row label="Database running for" value={since(db.started_at)} />
        </Section>
        <Section title="Database">
          <Row label="Size" value={bytes(db.size_bytes)} />
          <Row label="Connections" value={`${db.connections} of ${db.max_connections}`} level={connPct >= 90 ? 'bad' : connPct >= 70 ? 'warn' : 'ok'} />
          <Row label="Queries running over a minute" value={String(db.long_queries)} level={db.long_queries ? 'warn' : 'ok'} />
          <Row label="Cache hit rate" value={db.cache_hit_percent === null ? 'No data yet' : `${db.cache_hit_percent}%`} level={db.cache_hit_percent === null ? undefined : db.cache_hit_percent >= 95 ? 'ok' : 'warn'} />
          <Row label="Deadlocks since last reset" value={String(db.deadlocks)} level={db.deadlocks ? 'warn' : 'ok'} />
          <Row label="Postgres" value={db.version} />
          <Row label="Latest migration" value={db.latest_migration ?? 'Unknown'} />
        </Section>
        <Section title="Security">
          <Row label="Staff accounts" value={String(sec.staff_total)} />
          <Row label="Staff without an authenticator" value={String(sec.staff_without_mfa)} level={sec.staff_without_mfa ? 'bad' : 'ok'} />
          <Row label="Staff with under 3 recovery codes" value={String(sec.staff_low_on_codes)} level={sec.staff_low_on_codes ? 'warn' : 'ok'} />
          <Row label="Invitations waiting" value={String(sec.open_invitations)} />
          <Row label="Wrong authenticator codes today" value={String(sec.failed_mfa_24h)} level={sec.failed_mfa_24h >= 5 ? 'warn' : 'ok'} />
          <Row label="Wrong recovery codes today" value={String(sec.failed_recovery_24h)} level={sec.failed_recovery_24h ? 'warn' : 'ok'} />
          <Row label="Accounts locked from recovery" value={String(sec.accounts_locked)} level={sec.accounts_locked ? 'bad' : 'ok'} />
        </Section>
        <Section title="Scheduled jobs">
          {!data.jobs?.length ? <p className="text-sm text-muted">pg_cron is not running here, so there is no uptime history.</p>
            : data.jobs.map((j) => <Row key={j.job} label={j.job} value={j.last_run ? `${j.last_status ?? 'unknown'} · ${formatTime(j.last_run)}` : 'Has not run yet'} level={j.last_status === 'failed' || !j.active ? 'bad' : j.last_run ? 'ok' : undefined} />)}
        </Section>
        <Section title="Largest tables">
          {data.tables.map((t) => <Row key={t.name} label={t.name} value={bytes(t.bytes)} />)}
        </Section>
      </div>
    </div>
  );
}
