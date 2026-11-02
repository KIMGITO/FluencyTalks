import { useEffect, useState } from 'react';
import { Card, EmptyState, ErrorState, RowListSkeleton, Tabs } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminAuditFeed, adminAuthEvents, adminLogs, type AppLog, type AuditEntry, type AuthEvent } from '@/services/admin';

type Tab = 'app' | 'audit' | 'auth';
const ACTIONS: Record<string, string> = {
  super_admin_created: 'super admin account created', staff_invited: 'invited a staff member', invitation_revoked: 'cancelled an invitation', invitation_accepted: 'accepted an invitation',
  staff_removed: 'removed from the team', mfa_reset: 'reset MFA', mfa_break_glass: 'reset MFA from the owner script', mfa_factor_verified: 'turned on an authenticator', mfa_factor_removed: 'removed an authenticator',
  mfa_failed: 'entered a wrong authenticator code', recovery_codes_generated: 'made new recovery codes', recovery_code_used: 'used a recovery code', recovery_code_failed: 'entered a wrong recovery code',
};

function useFeed<T>(fetcher: () => Promise<T[]>, deps: unknown[]) {
  const [items, setItems] = useState<T[] | null>(null); const [failed, setFailed] = useState(false);
  const load = () => { setFailed(false); fetcher().then(setItems).catch(() => setFailed(true)); };
  useEffect(() => { setItems(null); load(); }, deps);
  return { items, failed, load };
}

function AppLogs() {
  const [level, setLevel] = useState<AppLog['level'] | 'all'>('all');
  const { items, failed, load } = useFeed(() => adminLogs(level === 'all' ? undefined : level), [level]);
  return (
    <div className="space-y-3">
      <div className="ft-inset flex gap-2" role="group" aria-label="Filter by level">
        {(['all', 'error', 'warn', 'info'] as const).map((l) => <button key={l} type="button" aria-pressed={l === level} onClick={() => setLevel(l)} className={`rounded-sm px-3 py-1.5 text-sm font-semibold capitalize ${l === level ? 'bg-ink text-bg' : 'bg-surface-2 text-ink'}`}>{l}</button>)}
      </div>
      {failed ? <ErrorState title="Couldn't load the logs" onRetry={load} /> : !items ? <RowListSkeleton label="Loading the logs" /> : !items.length ? <EmptyState title="Nothing logged" text="Browser errors and edge function failures appear here. Logs are kept for 30 days." /> : (
        <Card pad={false} className="divide-y divide-border">
          {items.map((l) => (
            <details key={l.id} className="p-3 text-sm md:px-4">
              <summary className="cursor-pointer"><b className={l.level === 'error' ? 'text-danger' : ''}>{l.level.toUpperCase()}</b> <span className="break-words">{l.message}</span></summary>
              <p className="mt-1 text-xs text-muted">{l.source}{l.username && ` · @${l.username}`} · {formatTime(l.created_at)}</p>
              {Object.keys(l.context).length > 0 && <pre className="mt-1 overflow-x-auto rounded-md bg-surface-2 p-2 text-xs">{JSON.stringify(l.context, null, 2)}</pre>}
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}

function Audit() {
  const { items, failed, load } = useFeed<AuditEntry>(adminAuditFeed, []);
  if (failed) return <ErrorState title="Couldn't load the audit trail" onRetry={load} />;
  if (!items) return <RowListSkeleton label="Loading the audit trail" />;
  if (!items.length) return <EmptyState title="No staff activity yet" />;
  return (
    <Card pad={false} className="divide-y divide-border">
      {items.map((a) => (
        <p key={a.id} className="p-3 text-sm md:px-4">
          <b>{a.actor_email ?? 'System'}</b> {ACTIONS[a.action] ?? a.action.replace(/_/g, ' ')}{a.target_email && a.target_email !== a.actor_email && <> · <b>{a.target_email}</b></>}
          <span className="text-muted"> · {formatTime(a.created_at)}</span>
          {typeof a.detail.reason === 'string' && <span className="block text-xs text-muted">Reason: {a.detail.reason}</span>}
          {typeof a.detail.email === 'string' && <span className="block text-xs text-muted">{a.detail.email}</span>}
        </p>
      ))}
    </Card>
  );
}

function SignIns() {
  const { items, failed, load } = useFeed<AuthEvent>(adminAuthEvents, []);
  if (failed) return <ErrorState title="Couldn't load sign-ins" onRetry={load} />;
  if (!items) return <RowListSkeleton label="Loading sign-ins" />;
  return (
    <div className="space-y-3">
      <p className="ft-inset text-xs text-muted">As recorded by Supabase Auth, for everyone. Wrong passwords aren't recorded here: see Logs → Auth in the Supabase dashboard.</p>
      {!items.length ? <EmptyState title="No sign-in records" text="Supabase may have database audit logging turned off for this project." /> : (
        <Card pad={false} className="divide-y divide-border">
          {items.map((e) => (
            <p key={e.id} className="p-3 text-sm md:px-4"><b>{e.actor ?? 'Unknown'}</b> {(e.action ?? 'event').replace(/_/g, ' ')}<span className="text-muted">{e.ip_address && ` · ${e.ip_address}`}{e.created_at && ` · ${formatTime(e.created_at)}`}</span></p>
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
