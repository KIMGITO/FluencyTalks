import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, CircleX, FileSearch, Info, KeyRound, TriangleAlert } from 'lucide-react';
import { Avatar, Card, EmptyState, ErrorState, RowListSkeleton, Select, Tabs } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { formatTime, timeAgo } from '@/lib/format';
import { adminAuditFeed, adminAuthEvents, adminLogs, type AppLog, type AuditEntry, type AuthEvent } from '@/services/admin';
import { Chip, IconTile, RefreshButton, Toolbar, type Tone } from './AdminKit';

type Tab = 'app' | 'audit' | 'auth';
const ACTIONS: Record<string, string> = {
  blog_publish: 'published a blog post', blog_unpublish: 'took a blog post off the site', blog_delete: 'deleted a blog post',
  super_admin_created: 'super admin account created', staff_invited: 'invited a staff member', invitation_revoked: 'cancelled an invitation', invitation_accepted: 'accepted an invitation',
  staff_removed: 'removed from the team', mfa_reset: 'reset MFA', mfa_break_glass: 'reset MFA from the owner script', mfa_factor_verified: 'turned on an authenticator', mfa_factor_removed: 'removed an authenticator',
  mfa_failed: 'entered a wrong authenticator code', recovery_codes_generated: 'made new recovery codes', recovery_code_used: 'used a recovery code', recovery_code_failed: 'entered a wrong recovery code',
};
const LEVEL: Record<AppLog['level'], { tone: Tone; icon: typeof Info }> = { error: { tone: 'danger', icon: CircleX }, warn: { tone: 'sun', icon: TriangleAlert }, info: { tone: 'muted', icon: Info } };

function useFeed<T>(fetcher: () => Promise<T[]>, deps: unknown[]) {
  const [items, setItems] = useState<T[] | null>(null); const [failed, setFailed] = useState(false);
  const refresh = useAction(async () => { setItems(await fetcher()); setFailed(false); }, { success: 'Up to date.' });
  const load = useCallback(() => { setFailed(false); fetcher().then(setItems).catch(() => setFailed(true)); }, deps);
  useEffect(() => { setItems(null); load(); }, [load]);
  return { items, failed, load, refresh };
}

function AppLogs() {
  const [level, setLevel] = useState<AppLog['level'] | 'all'>('all');
  const { items, failed, load, refresh } = useFeed(() => adminLogs(level === 'all' ? undefined : level), [level]);
  return (
    <div className="space-y-3">
      <Toolbar>
        <div className="min-w-0 flex-1 basis-[10rem] sm:max-w-[14rem]"><Select className="border-border" aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value as AppLog['level'] | 'all')}>
          <option value="all">All levels</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="info">Info</option>
        </Select></div>
        <RefreshButton busy={refresh.busy} onClick={() => void refresh.run()} />
      </Toolbar>
      {failed ? <ErrorState title="Couldn't load the logs" onRetry={load} /> : !items ? <RowListSkeleton label="Loading the logs" /> : !items.length ? <EmptyState icon={<IconTile icon={FileSearch} />} title="Nothing logged" text="Browser errors and edge function failures appear here. Logs are kept for 30 days." /> : (
        <Card pad={false} className="divide-y divide-border">
          {items.map((l) => (
            <details key={l.id} className="group p-3 text-sm md:px-4">
              <summary className="flex cursor-pointer list-none items-start gap-2.5 [&::-webkit-details-marker]:hidden">
                <Chip tone={LEVEL[l.level].tone} icon={LEVEL[l.level].icon}><span className="capitalize">{l.level}</span></Chip>
                <span className="ft-selectable min-w-0 flex-1 break-words">{l.message}</span>
                <ChevronDown size={16} aria-hidden className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 text-xs text-muted">{l.source}{l.username && ` · @${l.username}`} · {formatTime(l.created_at)} ({timeAgo(l.created_at)})</p>
              {Object.keys(l.context).length > 0 && <pre className="ft-selectable mt-1.5 overflow-x-auto rounded-md bg-surface-2 p-2 text-xs">{JSON.stringify(l.context, null, 2)}</pre>}
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}

function Audit() {
  const { items, failed, load, refresh } = useFeed<AuditEntry>(adminAuditFeed, []);
  if (failed) return <ErrorState title="Couldn't load the audit trail" onRetry={load} />;
  if (!items) return <RowListSkeleton label="Loading the audit trail" />;
  return (
    <div className="space-y-3">
      <Toolbar><span className="flex-1" /><RefreshButton busy={refresh.busy} onClick={() => void refresh.run()} /></Toolbar>
      {!items.length ? <EmptyState icon={<IconTile icon={FileSearch} />} title="No staff activity yet" /> : (
        <Card pad={false} className="divide-y divide-border">
          {items.map((a) => (
            <div key={a.id} className="flex gap-3 p-3 text-sm md:px-4">
              <Avatar name={a.actor_email ?? 'System'} size="sm" />
              <p className="min-w-0 flex-1 break-words">
                <b>{a.actor_email ?? 'System'}</b> {ACTIONS[a.action] ?? a.action.replace(/_/g, ' ')}{a.target_email && a.target_email !== a.actor_email && <> · <b>{a.target_email}</b></>}
                {typeof a.detail.reason === 'string' && <span className="ft-selectable block text-xs text-muted">Reason: {a.detail.reason}</span>}
                {typeof a.detail.email === 'string' && <span className="block text-xs text-muted">{a.detail.email}</span>}
                <span className="block text-xs text-muted" title={formatTime(a.created_at)}>{timeAgo(a.created_at)}</span>
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function SignIns() {
  const { items, failed, load, refresh } = useFeed<AuthEvent>(adminAuthEvents, []);
  if (failed) return <ErrorState title="Couldn't load sign-ins" onRetry={load} />;
  if (!items) return <RowListSkeleton label="Loading sign-ins" />;
  return (
    <div className="space-y-3">
      <Toolbar><p className="min-w-0 flex-1 basis-[14rem] self-center text-xs text-muted">As recorded by Supabase Auth, for everyone. Wrong passwords aren't recorded here: see Logs → Auth in the Supabase dashboard.</p><RefreshButton busy={refresh.busy} onClick={() => void refresh.run()} /></Toolbar>
      {!items.length ? <EmptyState icon={<IconTile icon={KeyRound} />} title="No sign-in records" text="Supabase may have database audit logging turned off for this project." /> : (
        <Card pad={false} className="divide-y divide-border">
          {items.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 text-sm md:px-4">
              <Avatar name={e.actor ?? 'Unknown'} size="sm" />
              <p className="min-w-0 flex-1 break-words"><b>{e.actor ?? 'Unknown'}</b> {(e.action ?? 'event').replace(/_/g, ' ')}<span className="block text-xs text-muted">{e.ip_address && <code className="ft-selectable">{e.ip_address}</code>}{e.ip_address && e.created_at && ' · '}{e.created_at && timeAgo(e.created_at)}</span></p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export function AdminAudit() {
  const [tab, setTab] = useState<Tab>('app');
  return (
    <div className="space-y-4">
      <div className="ft-inset"><Tabs value={tab} onChange={setTab} items={[{ key: 'app', label: 'Application' }, { key: 'audit', label: 'Staff audit' }, { key: 'auth', label: 'Sign-ins' }]} /></div>
      {tab === 'app' ? <AppLogs /> : tab === 'audit' ? <Audit /> : <SignIns />}
    </div>
  );
}
