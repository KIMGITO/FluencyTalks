import type { DisplayLanguage, Language } from '@/lib/languages';
import type { PostType } from '@/lib/postTypes';

export type Role = 'native' | 'learning';
export type LevelCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Native';

export interface UserLanguage { language_id: string; role: Role; level: LevelCode; verified_level?: LevelCode | null; native_name?: string | null; english_name?: string | null }
export interface Person { id: string; username: string; display_name: string; avatar_url: string | null; bio: string; timezone: string | null; country_code: string | null; is_private: boolean; languages: UserLanguage[] }

export type MatchKind = 'swap' | 'native' | 'learning' | 'other';

export type FeedPerson = Person & { match_kind: MatchKind; match_language: string | null; /** Set when we've chatted before, over 30 days ago. */ last_chatted_at: string | null };
export interface Country { code: string; name: string }

export interface FullProfile extends Person { relationship: { is_me: boolean } }
export interface Message { id: string; conversation_id: string; sender_id: string; body: string; reply_to: string | null; created_at: string; edited_at: string | null; deleted_at: string | null; language_id: string | null; is_bounty: boolean; bounty_cost: number | null; bounty_status: 'none' | 'open' | 'paid' | 'refunded'; bounty_expires_at: string | null }

export interface MessageHit { message_id: string; conversation_id: string; body: string; created_at: string; sender_id: string; sender_name: string; sender_username: string; sender_avatar: string | null; other_id: string; other_name: string; other_username: string; other_avatar: string | null; }
export interface ConversationRow { conversation_id: string; other_user_id: string; other_name: string; other_username: string; other_avatar: string | null; last_body: string | null; last_at: string; unread_count: number; status: 'active' | 'request' | 'ignored'; other_status: 'active' | 'request' | 'ignored' }

export type { Language, DisplayLanguage } from '@/lib/languages';
export interface MyProfile { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string; timezone: string | null; country_code: string | null; is_private: boolean; onboarding_done: boolean; role: string; points_balance: number; native_language_id: string | null; learning_language_id: string | null; learning_level: string | null; verified_level: string | null; show_activity: boolean; notification_prefs?: Record<string, boolean>; last_language_change_at: string | null }
/** dismissed = declined by the sender (with a reason); superseded = another answer to the same bounty was accepted. */
export type CorrectionStatus = 'pending' | 'accepted' | 'dismissed' | 'superseded';
export interface Correction {
  id: string; message_id: string; corrector_id: string; suggested_text: string; note: string | null; status: CorrectionStatus;
  feedback?: 'helpful' | 'not_helpful' | null; created_at: string;
  decided_at?: string | null; decision_note?: string | null;
  /** Who wrote it: a bounty answer usually comes from someone outside the chat. */
  corrector?: { username: string | null; display_name: string | null } | null;
}
export interface SavedPhrase { id: string; phrase: string; translation: string | null; language_id: string | null; source_message_id: string | null; source_post_id?: string | null; created_at: string; is_public: boolean; unsplash_image_url: string | null }

export interface TranslationRecord { id: string; source_text: string; translated_text: string; language_id: string | null; source_message_id: string | null; created_at: string }

export interface CorrectionHistory { id: string; message_id: string; conversation_id: string; original_text: string; suggested_text: string; note: string | null; status: CorrectionStatus; corrector_id: string; corrector_name: string; corrector_username: string; created_at: string }
export interface Reaction { message_id: string; user_id: string; emoji: string }
export type NotificationType = 'message_request' | 'correction' | 'correction_accepted' | 'bounty_paid' | 'level_up' | 'level_vouch'
  | 'post_correction' | 'post_challenged' | 'post_clarification' | 'post_reply' | 'post_endorsed'
  | 'post_accepted' | 'post_declined' | 'post_withdrawn' | 'post_superseded' | 'post_resolved' | 'post_reverted' | 'post_override'
  | 'action_reminder' | 'action_overdue' | 'action_escalated' | 'restriction_warning' | 'restriction_applied' | 'restriction_lifted' | 'appeal_decided'
  | 'admin_report' | 'admin_appeal' | 'admin_security' | 'admin_site';
export type NotificationCategory = 'corrections' | 'decisions' | 'reminders' | 'system' | 'reports' | 'escalations' | 'security';
export interface AppNotification {
  id: string; type: NotificationType; data: { conversation_id?: string; message_id?: string; points?: number; level?: string; language?: string; post_id?: string; item_id?: string; phrase?: string; note?: string; status?: string; granted?: boolean; waiting?: boolean; overdue?: number; due_at?: string };
  category?: NotificationCategory; read_at: string | null; created_at: string;
  actor_id: string | null; actor_username: string | null; actor_name: string | null; actor_avatar: string | null;
}
export type AccountStatus = 'active' | 'suspended' | 'banned';
export interface ReportEvidence { id: string; sender_id: string; body: string; created_at: string }
export interface AdminReport {
  id: string; reason: string; details: string | null; evidence: ReportEvidence[]; status: 'open' | 'reviewing' | 'actioned' | 'dismissed'; created_at: string; conversation_id: string | null;
  reporter_id: string | null; reporter_username: string | null; reporter_name: string | null; target_id: string | null; target_username: string | null; target_name: string | null; target_status: AccountStatus | null; target_open_reports: number;
  post_id: string | null;   // set when the report is about a library post
}
export interface AdminUser { id: string; username: string; display_name: string | null; role: 'user' | 'moderator' | 'admin'; status: AccountStatus; created_at: string; open_reports: number; manageable: boolean }
export interface AdminAction { id: string; action: 'suspend' | 'ban' | 'reinstate' | 'dismiss_report' | 'auto_suspend'; reason: string | null; created_at: string; admin_name: string | null; target_username: string | null; target_name: string | null }

export interface ContributionPost {
  id: string; user_id: string; certified_at: string; language_id: string | null;
  phrase: string; translation: string | null; category: 'phrase' | 'idiom' | 'usage' | 'grammar'; source_context: string | null;
  unsplash_image_url: string | null; created_at: string; updated_at: string;
  current_phrase?: string | null; current_translation?: string | null; accepted_item_id?: string | null;
  post_type?: PostType; body?: string | null; current_body?: string | null; image_layout?: 'above' | 'overlay';
  review_status?: 'awaiting_feedback' | 'corrections_received' | 'under_review' | 'reviewed'; open_corrections?: number; thread_count?: number; endorse_count?: number;
  text_align: 'left' | 'center' | 'right'; pinned_at: string | null;
  saved?: boolean;   // whether the current user saved it
  author?: Person | null;
}

export interface SavedPartner { user_id: string; partner_id: string; created_at: string }
