import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, MailPlus, ShieldAlert, ShieldCheck, Trash2, UserMinus, Users, Hourglass } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Avatar, Button, ConfirmDialog, ErrorState, Input, RowListSkeleton, Select } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { adminListTeam, adminRevokeInvitation, inviteStaff, removeStaff, resetStaffMfa, type StaffTier, type Team, type TeamInvitation, type TeamMember } from '@/services/admin';
import { toast } from '@/store/toastStore';
import { ActionMenu, Chip, Panel, type Tone } from './AdminKit';

const TIER: Record<StaffTier, { label: string; tone: Tone }> = { super: { label: 'Super admin', tone: 'accent' }, admin: { label: 'Admin', tone: 'brand' }, moderator: { label: 'Moderator', tone: 'aqua' } };
type Dialog = { kind: 'reset' | 'remove'; member: TeamMember } | null;

export function AdminTeam() {
  const myTier = useOutletContext<StaffTier>(); const isSuper = myTier === 'super';
  const [team, setTeam] = useState<Team | null>(null); const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState(''); const [tier, setTier] = useState<'admin' | 'moderator'>('admin'); const [busy, setBusy] = useState(false); const [inviteError, setInviteError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null); const [cancelling, setCancelling] = useState<TeamInvitation | null>(null);
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
        <Panel title="Invite someone" icon={MailPlus} tone="accent">
          <form onSubmit={invite} className="space-y-3">
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
              <Input id="invite-email" type="email" label="Email" error={inviteError || undefined} value={email} onChange={(e) => { setEmail(e.target.value); setInviteError(''); }} required />
              <Select className="border-border" label="Role" value={tier} onChange={(e) => setTier(e.target.value as 'admin' | 'moderator')}>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
              </Select>
              <Button type="submit" className="py-2.5" loading={busy}>{busy ? 'Sending…' : 'Send invitation'}</Button>
            </div>
            <p className="text-xs text-muted">The link works for 72 hours, only for this address. They set a password, log in, and scan a QR code before they can do anything.</p>
          </form>
        </Panel>
      ) : <p className="ft-inset text-sm text-muted">Only the super admin can invite or remove staff.</p>}

      <Panel title="The team" icon={Users} tone="brand" count={team.members.length} pad={false}>
        <div className="divide-y divide-border">
          {team.members.map((m) => (
            <div key={m.user_id} className="flex flex-wrap items-center gap-3 p-3 md:px-4">
              <Avatar name={m.name ?? m.email} />
              <div className="min-w-0 flex-1 basis-[12rem]">
                <p className="truncate font-semibold">{m.name ?? m.email}</p>
                <p className="ft-selectable truncate text-sm text-muted">{m.email}</p>
                <p className="text-xs text-muted">{m.last_sign_in_at ? `Last login ${formatTime(m.last_sign_in_at)}` : 'Has not logged in'}</p>
              </div>
              <span className="flex flex-wrap items-center gap-1.5">
                <Chip tone={TIER[m.tier].tone}>{TIER[m.tier].label}</Chip>
                {m.status !== 'active' && <Chip tone="danger"><span className="capitalize">{m.status}</span></Chip>}
                {m.mfa_factors > 0
                  ? <Chip tone="success" icon={ShieldCheck}>{m.mfa_factors === 1 ? 'Authenticator on' : `${m.mfa_factors} authenticators`}</Chip>
                  : <Chip tone="danger" icon={ShieldAlert}>No authenticator yet</Chip>}
              </span>
              {isSuper && m.tier !== 'super' && (
                <span className="ml-auto"><ActionMenu label={`Manage ${m.email}`} actions={[
                  { label: 'Reset MFA', icon: KeyRound, disabled: !m.mfa_factors, onSelect: () => setDialog({ kind: 'reset', member: m }) },
                  { label: 'Remove from team', icon: UserMinus, danger: true, onSelect: () => setDialog({ kind: 'remove', member: m }) },
                ]} /></span>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {team.invitations.length > 0 && (
        <Panel title="Waiting to accept" icon={Hourglass} tone="sun" count={team.invitations.length} pad={false}>
          <div className="divide-y divide-border">
            {team.invitations.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 p-3 md:px-4">
                <div className="min-w-0 flex-1 basis-[12rem]"><p className="ft-selectable truncate font-semibold">{i.email}</p><p className="text-xs text-muted">Expires {formatTime(i.expires_at)}</p></div>
                <Chip tone={TIER[i.tier].tone}>{TIER[i.tier].label}</Chip>
                {isSuper && <Button size="sm" variant="ghost" onClick={() => setCancelling(i)}><Trash2 size={15} aria-hidden /> Cancel</Button>}
              </div>
            ))}
          </div>
        </Panel>
      )}
      <ConfirmDialog open={!!dialog} danger={dialog?.kind === 'remove'} title={dialog?.kind === 'reset' ? `Reset MFA for ${dialog.member.email}?` : `Remove ${dialog?.member.email} from the team?`}
        confirmLabel={dialog?.kind === 'reset' ? 'Reset MFA' : 'Remove'} reasonLabel="Reason (kept on the record)" reasonRequired onClose={() => setDialog(null)} onConfirm={act}>
        {dialog?.kind === 'reset' ? 'Removes their authenticators and recovery codes and ends their admin sessions at once. Confirm who is asking first, through a channel other than email.' : 'Their admin access ends at once. Their ordinary learner account stays.'}
      </ConfirmDialog>
      <ConfirmDialog open={!!cancelling} danger title={`Cancel the invitation for ${cancelling?.email}?`} confirmLabel="Cancel invitation" onClose={() => setCancelling(null)}
        onConfirm={async () => { await adminRevokeInvitation(cancelling!.id); toast.success('Invitation cancelled.'); await load(); }}>
        The link in their email stops working straight away.
      </ConfirmDialog>
    </div>
  );
}
