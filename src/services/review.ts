import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { ContributionPost, Person } from '@/types/db';

export type ItemKind = 'correction' | 'clarification' | 'comment';
export type ItemStatus = 'pending' | 'accepted' | 'declined' | 'superseded' | 'withdrawn' | 'resolved';

export interface ThreadItem {
  id: string; parent_id: string | null; depth: number; kind: ItemKind; status: ItemStatus | null; created_at: string;
  decided_at: string | null; decision_note: string | null; decided_by_name: string | null;
  hidden: boolean; body: string | null; proposed_phrase: string | null; proposed_translation: string | null;
  author: Pick<Person, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  agree_count: number; i_agreed: boolean; flag_count: number; i_flagged: boolean;
  /** Set on a correction of one stretch of a long post. Counted in characters. */
  target_start: number | null; target_end: number | null; target_text: string | null;
  due_at: string | null; waiting_since: string | null; responsible_open: boolean;
}
export interface ThreadEvent { id: number; item_id: string | null; action: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string; actor_name: string | null }
export interface ResponseRecord { decided: number; on_time: number; open: number; overdue: number }
export interface PostThread {
  post: ContributionPost & { author: Pick<Person, 'id' | 'username' | 'display_name' | 'avatar_url'> };
  me: { is_owner: boolean; is_moderator: boolean; can_review: boolean; endorsed: boolean; muted: boolean };
  items: ThreadItem[];
  history: ThreadEvent[];
  owner_record: ResponseRecord;
}

export const getPostThread = (id: string) => rpc<PostThread | null>('get_post_thread', { p_post: id });
export const submitDiscussion = (a: { post: string; parent: string | null; kind: ItemKind; body: string; phrase?: string | null; translation?: string | null; clientKey: string; targetStart?: number | null; targetEnd?: number | null }) =>
  rpc<string>('submit_discussion', { p_post: a.post, p_parent: a.parent, p_kind: a.kind, p_body: a.body, p_phrase: a.phrase ?? null, p_translation: a.translation ?? null, p_client_key: a.clientKey, p_target_start: a.targetStart ?? null, p_target_end: a.targetEnd ?? null });
export const decideCorrection = (id: string, accept: boolean, note?: string) => rpc<string>('decide_correction', { p_id: id, p_accept: accept, p_note: note || null });
/** Not ready to decide: ask the person who proposed it. The deadline restarts, once per correction. */
export const askAboutCorrection = (id: string, question: string, clientKey: string) => rpc<string>('ask_about_correction', { p_id: id, p_question: question, p_client_key: clientKey });
export const resolveClarification = (id: string, note: string) => rpc('resolve_clarification', { p_id: id, p_note: note });
export const withdrawDiscussion = (id: string) => rpc('withdraw_discussion', { p_id: id });
export const revertAccepted = (post: string, note: string) => rpc('revert_accepted', { p_post: post, p_note: note });
export const overrideCorrection = (id: string, status: 'pending' | 'accepted' | 'declined', reason: string) => rpc('admin_override_correction', { p_id: id, p_status: status, p_reason: reason });
/** Practice posts only: optional, final. Helpful pays the helper and goes to the phrasebook; the original never changes. */
export const rateHelpFix = (id: string, helpful: boolean, note?: string) => rpc('rate_help_fix', { p_id: id, p_helpful: helpful, p_note: note || null });
export const toggleEndorsement = (post: string) => rpc<boolean>('toggle_post_endorsement', { p_post: post });
export const toggleAgreement = (id: string) => rpc<boolean>('toggle_correction_agreement', { p_id: id });
/** "I think this correction is wrong". Qualified people only; it replaces an agreement from the same person. */
export const toggleFlag = (id: string) => rpc<boolean>('toggle_correction_flag', { p_id: id });
export const setThreadMute = (post: string, muted: boolean) => rpc('set_thread_mute', { p_post: post, p_muted: muted });
export const markDecisionsViewed = (post: string) => rpc('mark_decisions_viewed', { p_post: post });

/** Something changed in this thread. It only says "look again": the data comes from get_post_thread. */
export function subscribeToThread(post: string, onChange: () => void) {
  const ch = supabase.channel(`thread:${post}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'post_discussion', filter: `post_id=eq.${post}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export interface OwedDecision { id: string; post_id: string; item_id: string; kind: ItemKind; created_at: string; due_at: string; viewed_at: string | null; overdue: boolean; extensions: number; phrase: string; proposed_phrase: string | null; author_name: string | null }
export interface Accountability {
  items: OwedDecision[];
  record: ResponseRecord;
  /** A pause is coming unless overdue decisions get answered. */
  warned_at: string | null;
  restriction: { id: string; reason: string; created_at: string; appeal: { status: string; message: string; decision_note: string | null } | null } | null;
  policy: { deadline_hours: number; first_reminder_hours: number; restrict_after_overdue: number; restrict_notice_hours: number; extension_hours: number; max_extensions: number; enabled: boolean };
}
export const getMyAccountability = () => rpc<Accountability>('my_accountability');
export const requestExtension = (item: string, reason: string) => rpc<string>('request_decision_extension', { p_item: item, p_reason: reason });
export const appealRestriction = (id: string, message: string) => rpc('appeal_restriction', { p_restriction: id, p_message: message });
export const setNotificationPrefs = (prefs: Record<string, boolean>) => rpc('set_notification_prefs', { p_prefs: prefs });

export interface AccountabilityPolicy { enabled: boolean; first_reminder_hours: number; repeat_reminder_hours: number; deadline_hours: number; escalate_after_hours: number; restrict_after_overdue: number; restrict_notice_hours: number; extension_hours: number; max_extensions: number; last_sweep_at: string | null }
export interface AdminAccountability {
  policy: AccountabilityPolicy;
  escalated: { id: string; item_id: string; post_id: string; due_at: string; owner_name: string | null; phrase: string; kind: ItemKind }[];
  restrictions: { id: string; user_id: string; name: string | null; reason: string; created_at: string }[];
  appeals: { id: string; name: string | null; message: string; created_at: string }[];
  audit: { id: number; action: string; reason: string; created_at: string; actor_name: string | null; target_name: string | null }[];
}
export const adminAccountability = () => rpc<AdminAccountability>('admin_accountability');
export const adminSetPolicy = (policy: Partial<AccountabilityPolicy>, reason: string) => rpc('admin_set_accountability_policy', { p_policy: policy, p_reason: reason });
export const adminDecideAppeal = (id: string, grant: boolean, note: string) => rpc('admin_decide_appeal', { p_appeal: id, p_grant: grant, p_note: note });
export const adminLiftRestriction = (id: string, reason: string) => rpc('admin_lift_restriction', { p_restriction: id, p_reason: reason });
export const adminExemptDecision = (id: string, reason: string) => rpc('admin_exempt_decision', { p_decision: id, p_reason: reason });
