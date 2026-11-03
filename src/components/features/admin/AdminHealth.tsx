import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Archive, CalendarClock, CircleCheck, CircleX, Database, Lock, Server, Table2, TriangleAlert, Timer, type LucideIcon } from 'lucide-react';
import { Chip, IconTile, Meter, Panel, RefreshButton, StatTile, type Tone } from './AdminKit';
import { ErrorState, RowListSkeleton } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminArchiveStatus, adminSystemHealth, probeHealth, type ArchiveStatus, type HealthProbe, type SystemHealth } from '@/services/admin';
import { toast } from '@/store/toastStore';

type Level = 'ok' | 'warn' | 'bad';
interface RowData { label: string; value: string; level?: Level; meter?: number }
interface SectionData { title: string; icon: LucideIcon; tone: Tone; note?: string; empty?: string; rows: RowData[] }
const ICON = { ok: CircleCheck, warn: TriangleAlert, bad: CircleX };
const TONE = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger' };
const LEVEL_TONE: Record<Level, Tone> = { ok: 'success', warn: 'sun', bad: 'danger' };

const Row = ({ label, value, level, meter }: RowData) => {
  const Icon = level && ICON[level];
  return (
    <div className="py-2.5 text-sm first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
        <span className="text-muted">{label}</span>
        <span className="ft-selectable flex min-w-0 items-center gap-1.5 break-all font-semibold tabular-nums">{Icon && <Icon size={16} aria-hidden className={clsx('shrink-0', TONE[level!])} />}{value}</span>
      </div>
      {meter !== undefined && <span className="mt-1.5 block"><Meter percent={meter} tone={level ? LEVEL_TONE[level] : 'brand'} label={label} /></span>}
    </div>
  );
};
const bytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
const since = (iso: string) => { const h = (Date.now() - new Date(iso).getTime()) / 36e5; return h >= 48 ? `${Math.floor(h / 24)} days` : h >= 1 ? `${Math.floor(h)} hours` : `${Math.max(1, Math.floor(h * 60))} minutes`; };
const uptimeLevel = (p: number | null): Level | undefined => (p === null ? undefined : p >= 99.5 ? 'ok' : p >= 95 ? 'warn' : 'bad');
const pct = (p: number | null) => (p === null ? 'No data' : `${p}%`);

const archiveRows = (a: ArchiveStatus | null): RowData[] => {
  if (!a) return [];
  // A day past its hot window is normal until the next run. Two days means the runs have stopped.
  const waitingDays = a.oldest_waiting ? (Date.now() - new Date(a.oldest_waiting).getTime()) / 864e5 : 0;
  const checkpointDays = a.last_checkpoint_at ? (Date.now() - new Date(a.last_checkpoint_at).getTime()) / 864e5 : 0;
  return [
    { label: 'Archive set up', value: a.configured ? 'Yes' : 'No: logs are kept but not archived', level: a.configured ? 'ok' : 'warn' },
    { label: 'Tamper-proof copy', value: !a.last_checkpoint_at ? 'Not connected: nothing is being archived' : `Last written ${formatTime(a.last_checkpoint_at)}`, level: !a.last_checkpoint_at || checkpointDays > 2 ? 'bad' : 'ok' },
    { label: 'Integrity check', value: a.integrity_ok === null ? 'Not run yet' : a.integrity_ok ? 'Records match' : 'RECORDS HAVE BEEN CHANGED', level: a.integrity_ok === false ? 'bad' : a.integrity_ok ? 'ok' : undefined },
    { label: 'Consent records', value: String(a.consent_records) },
    { label: 'Failed archive files', value: String(a.failed), level: a.failed ? 'bad' : 'ok' },
    { label: 'Oldest rows waiting to archive', value: a.oldest_waiting ? formatTime(a.oldest_waiting) : 'None', level: a.oldest_waiting && a.configured && waitingDays > 2 ? 'warn' : undefined },
    { label: 'Files past their destroy date', value: String(a.overdue_destruction), level: a.overdue_destruction ? 'warn' : 'ok' },
    { label: 'Legal holds', value: String(a.active_holds) },
    { label: 'Archived', value: `${a.files} files · ${a.rows} rows · ${bytes(a.bytes)}` },
    { label: 'Last archived', value: a.last_released_at ? formatTime(a.last_released_at) : 'Not yet' },
    { label: 'Files destroyed on schedule', value: String(a.destroyed) },
  ];
};

function sectionsFor(data: SystemHealth, probe: HealthProbe | null, probeFailed: boolean, archive: ArchiveStatus | null): SectionData[] {
  const { database: db, uptime, security: sec } = data;
  const connPct = Math.round((100 * db.connections) / db.max_connections);
  const beatAge = uptime.last_beat ? (Date.now() - new Date(uptime.last_beat).getTime()) / 60000 : null;
  return [
    { title: 'Services', icon: Server, tone: 'aqua', note: 'Asked from an edge function just now.', rows: probeFailed ? [{ label: 'Edge functions', value: 'Not answering', level: 'bad' }]
      : !probe ? [{ label: 'Edge functions', value: 'Checking…' }]
      : [
        ...probe.services.map((s): RowData => ({ label: s.name, value: s.ok ? (s.ms ? `Up · ${s.ms} ms` : 'Up') : `Down${s.status ? ` · ${s.status}` : ''}`, level: s.ok ? 'ok' : 'bad' })),
        { label: 'Web push keys', value: probe.secrets.web_push ? 'Set' : 'Not set', level: probe.secrets.web_push ? 'ok' : 'warn' },
        { label: 'Unsplash key', value: probe.secrets.unsplash ? 'Set' : 'Not set', level: probe.secrets.unsplash ? 'ok' : 'warn' },
      ] },
    { title: 'Heartbeat', icon: Timer, tone: 'sun', note: 'From a once-a-minute database heartbeat, so this covers the database and its scheduler, not the website. Use an outside monitor for that (docs/ADMIN_SETUP.md).', rows: [
      { label: 'Last heartbeat', value: uptime.last_beat ? formatTime(uptime.last_beat) : 'Never: pg_cron is not running', level: beatAge === null || beatAge > 5 ? 'bad' : 'ok' },
      { label: 'Database running for', value: since(db.started_at) },
    ] },
    { title: 'Database', icon: Database, tone: 'brand', rows: [
      { label: 'Size', value: bytes(db.size_bytes) },
      { label: 'Connections', value: `${db.connections} of ${db.max_connections}`, level: connPct >= 90 ? 'bad' : connPct >= 70 ? 'warn' : 'ok', meter: connPct },
      { label: 'Queries running over a minute', value: String(db.long_queries), level: db.long_queries ? 'warn' : 'ok' },
      { label: 'Cache hit rate', value: db.cache_hit_percent === null ? 'No data yet' : `${db.cache_hit_percent}%`, level: db.cache_hit_percent === null ? undefined : db.cache_hit_percent >= 95 ? 'ok' : 'warn', meter: db.cache_hit_percent ?? undefined },
      { label: 'Deadlocks since last reset', value: String(db.deadlocks), level: db.deadlocks ? 'warn' : 'ok' },
      { label: 'Postgres', value: db.version },
      { label: 'Latest migration', value: db.latest_migration ?? 'Unknown' },
    ] },
    { title: 'Security', icon: Lock, tone: 'accent', rows: [
      { label: 'Staff accounts', value: String(sec.staff_total) },
      { label: 'Staff without an authenticator', value: String(sec.staff_without_mfa), level: sec.staff_without_mfa ? 'bad' : 'ok' },
      { label: 'Staff with under 3 recovery codes', value: String(sec.staff_low_on_codes), level: sec.staff_low_on_codes ? 'warn' : 'ok' },
      { label: 'Invitations waiting', value: String(sec.open_invitations) },
      { label: 'Wrong authenticator codes today', value: String(sec.failed_mfa_24h), level: sec.failed_mfa_24h >= 5 ? 'warn' : 'ok' },
      { label: 'Wrong recovery codes today', value: String(sec.failed_recovery_24h), level: sec.failed_recovery_24h ? 'warn' : 'ok' },
      { label: 'Accounts locked from recovery', value: String(sec.accounts_locked), level: sec.accounts_locked ? 'bad' : 'ok' },
    ] },
    { title: 'Scheduled jobs', icon: CalendarClock, tone: 'aqua', empty: 'pg_cron is not running here, so there is no uptime history.', rows: (data.jobs ?? []).map((j): RowData => ({ label: j.job, value: j.last_run ? `${j.last_status ?? 'unknown'} · ${formatTime(j.last_run)}` : 'Has not run yet', level: j.last_status === 'failed' || !j.active ? 'bad' : j.last_run ? 'ok' : undefined })) },
    { title: 'Data archive', icon: Archive, tone: 'sun', note: 'Old logs and records move to private and write-once storage, then get destroyed on schedule (docs/DATA_RETENTION.md).', empty: "Couldn't read the archive status.", rows: archiveRows(archive) },
    { title: 'Largest tables', icon: Table2, tone: 'muted', rows: data.tables.map((t): RowData => ({ label: t.name, value: bytes(t.bytes) })) },
  ];
}

export function AdminHealth() {
  const [data, setData] = useState<SystemHealth | null>(null); const [probe, setProbe] = useState<HealthProbe | null>(null); const [archive, setArchive] = useState<ArchiveStatus | null>(null);
  const [probeFailed, setProbeFailed] = useState(false); const [failed, setFailed] = useState(false); const [busy, setBusy] = useState(false);
  const load = async (announce = false) => {
    setBusy(true);
    const [dbOk, probeOk] = await Promise.all([
      adminSystemHealth().then((d) => { setData(d); setFailed(false); return true; }).catch(() => { setFailed(true); return false; }),
      probeHealth().then((p) => { setProbe(p); setProbeFailed(false); return true; }).catch(() => { setProbeFailed(true); return false; }),
      adminArchiveStatus().then(setArchive).catch(() => setArchive(null)),
    ]);
    setBusy(false);
    if (announce) { if (dbOk && probeOk) toast.success('Checked just now.'); else toast.error("Some checks didn't answer.", () => void load(true)); }
  };
  useEffect(() => { void load(); }, []);
  if (failed && !data) return <ErrorState title="Couldn't load system health" onRetry={() => void load()} busy={busy} />;
  if (!data) return <RowListSkeleton label="Loading system health" />;
  const sections = sectionsFor(data, probe, probeFailed, archive);
  const { uptime } = data;
  const uptimeRows: RowData[] = [
    { label: 'Uptime, 24 hours', value: pct(uptime.d1), level: uptimeLevel(uptime.d1) },
    { label: 'Uptime, 7 days', value: pct(uptime.d7), level: uptimeLevel(uptime.d7) },
    { label: 'Uptime, 30 days', value: pct(uptime.d30), level: uptimeLevel(uptime.d30) },
  ];
  const flagged = [...uptimeRows, ...sections.flatMap((s) => s.rows)].filter((r) => r.level === 'bad' || r.level === 'warn');
  const bad = flagged.some((r) => r.level === 'bad');
  const uptimeTone = (r: RowData): Tone => (r.level ? LEVEL_TONE[r.level] : 'muted');
  return (
    <div className="space-y-4">
      <section aria-live="polite" className={clsx('flex flex-wrap items-center gap-3 border-y p-3 md:rounded-lg md:border md:p-4', !flagged.length ? 'border-success/40 bg-success/10' : bad ? 'border-danger/40 bg-danger/10' : 'border-warning/40 bg-warning/10')}>
        <IconTile icon={!flagged.length ? CircleCheck : bad ? CircleX : TriangleAlert} tone={!flagged.length ? 'success' : bad ? 'danger' : 'sun'} />
        <div className="min-w-0 flex-1 basis-[12rem]">
          <h2 className="font-display text-xl font-medium leading-tight">{!flagged.length ? 'Everything looks healthy' : `${flagged.length} ${flagged.length === 1 ? 'thing' : 'things'} to look at`}</h2>
          <p className="text-xs text-muted">Checked {formatTime(data.checked_at)}</p>
        </div>
        <RefreshButton busy={busy} label="Check again" onClick={() => void load(true)} />
        {flagged.length > 0 && <div className="flex w-full flex-wrap gap-1.5">{flagged.map((r) => <Chip key={r.label} tone={r.level === 'bad' ? 'danger' : 'sun'}>{r.label}</Chip>)}</div>}
      </section>
      <div className="grid grid-cols-3 gap-2 px-3 md:gap-3 md:px-0">
        {uptimeRows.map((r, i) => <StatTile key={r.label} label={['24 hours', '7 days', '30 days'][i]} value={r.value} hint="uptime" icon={r.level ? ICON[r.level] : Timer} tone={uptimeTone(r)} delay={i * 50} />)}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <Panel key={s.title} title={s.title} icon={s.icon} tone={s.tone} note={s.note}>
            {s.rows.length ? <div className="divide-y divide-border">{s.rows.map((r) => <Row key={r.label} {...r} />)}</div> : <p className="text-sm text-muted">{s.empty}</p>}
          </Panel>
        ))}
      </div>
    </div>
  );
}
