import { rpc } from '@/lib/api';
import type { AccountStatus, AdminAction, AdminReport, AdminUser } from '@/types/db';
export type ReportReason = 'harassment' | 'spam' | 'inappropriate' | 'impersonation' | 'underage' | 'scam' | 'other';
export const reportUser = (userId: string, reason: ReportReason, details?: string, conversationId?: string) =>
  rpc<string>('report_user', { p_target: userId, p_reason: reason, p_details: details ?? null, p_conversation: conversationId ?? null });
// Admin tools (server verifies role; these fail with "forbidden" for normal users)
export const adminListReports = (status = 'open') => rpc<unknown[]>('admin_list_reports', { p_status: status });
export const adminReportQueue = (status: 'open' | 'actioned' | 'dismissed' = 'open') => rpc<AdminReport[]>('admin_report_queue', { p_status: status });
export const adminSearchUsers = (query?: string) => rpc<AdminUser[]>('admin_search_users', { p_query: query || null });
export const adminRecentActions = () => rpc<AdminAction[]>('admin_recent_actions');
export const adminSetUserStatus = (userId: string, status: AccountStatus, reason?: string, reportId?: string) =>
  rpc('admin_set_user_status', { p_user: userId, p_status: status, p_reason: reason ?? null, p_report: reportId ?? null });
export const adminDismissReport = (id: string) => rpc('admin_dismiss_report', { p_report: id });
