import { rpc } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { UserError } from '@/lib/errors';

export type StaffTier = 'super' | 'admin' | 'moderator';
export interface StaffStatus { is_staff: boolean; tier?: StaffTier; session_ok?: boolean; used_password?: boolean; recovery_codes_left?: number }
export interface TeamMember { user_id: string; email: string; tier: StaffTier; status: string; name: string | null; created_at: string; last_sign_in_at: string | null; mfa_factors: number; recovery_codes_left: number }
export interface TeamInvitation { id: string; email: string; tier: StaffTier; created_at: string; expires_at: string }
export interface Team { members: TeamMember[]; invitations: TeamInvitation[] }
export interface AdminOverview {
  users_total: number; users_new_7d: number; users_active_24h: number; users_suspended: number; users_banned: number;
  reports_open: number; reports_oldest_open: string | null; appeals_open: number; decisions_escalated: number; restrictions_active: number;
  messages_24h: number; posts_7d: number; errors_24h: number;
}
export interface SystemHealth {
  checked_at: string;
  database: { started_at: string; version: string; size_bytes: number; connections: number; max_connections: number; long_queries: number; cache_hit_percent: number | null; deadlocks: number; latest_migration: string | null };
  tables: { name: string; bytes: number; rows: number }[];
  uptime: { last_beat: string | null; d1: number | null; d7: number | null; d30: number | null };
  jobs: { job: string; schedule: string; active: boolean; last_status: string | null; last_run: string | null }[] | null;
  security: { staff_total: number; staff_without_mfa: number; staff_low_on_codes: number; open_invitations: number; failed_mfa_24h: number; failed_recovery_24h: number; accounts_locked: number };
}
export interface ArchiveStatus { configured: boolean; files: number; rows: number; bytes: number; destroyed: number; last_released_at: string | null; oldest_waiting: string | null; failed: number; active_holds: number; overdue_destruction: number; last_checkpoint_at: string | null; integrity_ok: boolean | null; consent_records: number }
export interface ServiceProbe { name: string; ok: boolean; status: number; ms: number }
export interface HealthProbe { services: ServiceProbe[]; secrets: { web_push: boolean; unsplash: boolean } }
export interface AppLog { id: number; level: 'info' | 'warn' | 'error'; source: string; message: string; context: Record<string, unknown>; created_at: string; username: string | null }
export interface AuditEntry { id: number; actor_email: string | null; action: string; target_email: string | null; detail: Record<string, unknown>; created_at: string }
export interface AuthEvent { id: string; created_at: string | null; ip_address: string | null; action: string | null; actor: string | null }

export const myStaffStatus = () => rpc<StaffStatus>('my_staff_status');
export const acceptAdminInvitation = (token: string) => rpc<StaffTier>('accept_admin_invitation', { p_token: token });
export const adminOverview = () => rpc<AdminOverview>('admin_overview');
export const adminListTeam = () => rpc<Team>('admin_list_team');
export const adminRevokeInvitation = (id: string) => rpc('admin_revoke_invitation', { p_id: id });
export const adminGenerateRecoveryCodes = () => rpc<string[]>('admin_generate_recovery_codes');
export const adminSystemHealth = () => rpc<SystemHealth>('admin_system_health');
export const adminArchiveStatus = () => rpc<ArchiveStatus>('admin_archive_status');
export const adminLogs = (level?: AppLog['level']) => rpc<AppLog[]>('admin_logs', { p_level: level ?? null, p_limit: 100, p_before: null });
export const adminAuditFeed = () => rpc<AuditEntry[]>('admin_audit_feed', { p_limit: 100 });
export const adminAuthEvents = () => rpc<AuthEvent[]>('admin_auth_events', { p_limit: 100 });
export const reportMfaFailure = () => rpc('report_mfa_failure').catch(() => undefined);

const EDGE_ERRORS: Record<string, string> = {
  forbidden: "You don't have access to that.", invalid_email: 'Enter a valid email address.', reserved_email: 'That address is reserved for the super admin.',
  already_staff: 'That person is already on the team.', reason_required: 'Please give a reason.', email_failed: "The email couldn't be sent, so the invitation was cancelled. Check the email settings in Supabase.",
  recovery_code_invalid: "That recovery code isn't valid. Each code works once.", recovery_locked: 'Too many wrong codes. Try again in an hour.',
};

async function staffAction<T = { ok: true }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-staff', { body });
  if (error) {
    const code = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new UserError((code && EDGE_ERRORS[code]) || 'Oops! Something went wrong. Please try again.');
  }
  return data as T;
}
export const inviteStaff = (email: string, tier: 'admin' | 'moderator') => staffAction<{ email: string }>({ action: 'invite', email, tier });
export const resetStaffMfa = (userId: string, reason: string) => staffAction({ action: 'reset_mfa', user_id: userId, reason });
export const removeStaff = (userId: string, reason: string) => staffAction({ action: 'remove_staff', user_id: userId, reason });
export const redeemRecoveryCode = (code: string) => staffAction({ action: 'redeem_recovery', code });
export const probeHealth = () => staffAction<HealthProbe>({ action: 'probe' });
