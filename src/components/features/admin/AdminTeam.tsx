import { useEffect, useState, type FormEvent } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Button, Card, ConfirmDialog, ErrorState, Input, RowListSkeleton, Select } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminListTeam, adminRevokeInvitation, inviteStaff, removeStaff, resetStaffMfa, type StaffTier, type Team, type TeamMember } from '@/services/admin';
import { toast } from '@/store/toastStore';

const TIER: Record<StaffTier, string> = { super: 'Super admin', admin: 'Admin', moderator: 'Moderator' };
type Dialog = { kind: 'reset' | 'remove'; member: TeamMember } | null;

export function AdminTeam() {
  const myTier = useOutletContext<StaffTier>(); const isSuper = myTier === 'super';
  const [team, setTeam] = useState<Team | null>(null); const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState(''); const [tier, setTier] = useState<'admin' | 'moderator'>('admin'); const [busy, setBusy] = useState(false); const [inviteError, setInviteError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const load = () => adminListTeam().then((t) => { setTeam(t); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => { void load(); }, []);

  const invite = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setInviteError('');
    try {
      const { email: sent } = await inviteStaff(email.trim(), tier);
      toast.success(`Invitation sent to ${sent}.`); setEmail(''); await load();
    } catch (err) { setInviteError((err as Error).message); }
    finally { setBusy(false); }
  };
  const act = async (reason: string) => {
    const d = dialog!;
    if (d.kind === 'reset') await resetStaffMfa(d.member.user_id, reason); else await removeStaff(d.member.user_id, reason);
    toast.success(d.kind === 'reset' ? 'Authenticators removed. They will see a new QR code at their next login.' : 'Removed from the team.');
    await load();
  };

  if (failed && !team) return <ErrorState title="Couldn't load the team" onRetry={() => void load()} />;
  if (!team) return <RowListSkeleton label="Loading the team" />;
  return (
    <div className="space-y-4">
      {isSuper ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">Invite someone</h2>
          <form onSubmit={invite} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
            <Input id="invite-email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Select label="Role" value={tier} onChange={(e) => setTier(e.target.value as 'admin' | 'moderator')}>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </Select>
            <Button type="submit" loading={busy}>Send invitation</Button>
          </form>
          {inviteError && <p role="alert" className="text-sm text-danger">{inviteError}</p>}
          <p className="text-xs text-muted">The link works for 72 hours, only for this address. They set a password, log in, and scan a QR code before they can do anything.</p>
        </Card>
      ) : <p className="ft-inset text-sm text-muted">Only the super admin can invite or remove staff.</p>}

      <Card pad={false} className="divide-y divide-border">
        {team.members.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-3 p-3 md:px-4">
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-semibold">{m.name ?? m.email}</p>
              <p className="truncate text-sm text-muted">{m.email}</p>
              <p className="mt-0.5 text-xs text-muted">{TIER[m.tier]}{m.status !== 'active' && ` · ${m.status}`} · {m.last_sign_in_at ? `last login ${formatTime(m.last_sign_in_at)}` : 'has not logged in'}</p>
            </div>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {m.mfa_factors > 0
                ? <><ShieldCheck size={16} aria-hidden className="text-success" /> {m.mfa_factors === 1 ? 'Authenticator on' : `${m.mfa_factors} authenticators`}</>
                : <><ShieldAlert size={16} aria-hidden className="text-danger" /> No authenticator yet</>}
            </span>
            {isSuper && m.tier !== 'super' && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={!m.mfa_factors} onClick={() => setDialog({ kind: 'reset', member: m })}>Reset MFA</Button>
                <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'remove', member: m })}>Remove</Button>
              </div>
            )}
          </div>
        ))}
      </Card>

      {team.invitations.length > 0 && (
        <Card pad={false} className="divide-y divide-border">
          <h2 className="p-3 font-semibold md:px-4">Waiting to accept</h2>
          {team.invitations.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 p-3 md:px-4">
              <div className="min-w-0 flex-1 basis-56"><p className="truncate font-semibold">{i.email}</p><p className="text-xs text-muted">{TIER[i.tier]} · expires {formatTime(i.expires_at)}</p></div>
              {isSuper && <Button size="sm" variant="secondary" onClick={() => void adminRevokeInvitation(i.id).then(load).catch((e) => toast.error((e as Error).message))}>Cancel</Button>}
            </div>
          ))}
        </Card>
      )}
      <ConfirmDialog open={!!dialog} danger={dialog?.kind === 'remove'} title={dialog?.kind === 'reset' ? `Reset MFA for ${dialog.member.email}?` : `Remove ${dialog?.member.email} from the team?`}
        confirmLabel={dialog?.kind === 'reset' ? 'Reset MFA' : 'Remove'} reasonLabel="Reason (kept on the record)" reasonRequired onClose={() => setDialog(null)} onConfirm={act}>
        {dialog?.kind === 'reset' ? 'Removes their authenticators and recovery codes and ends their admin sessions at once. Confirm who is asking first, through a channel other than email.' : 'Their admin access ends at once. Their ordinary learner account stays.'}
      </ConfirmDialog>
    </div>
  );
}
