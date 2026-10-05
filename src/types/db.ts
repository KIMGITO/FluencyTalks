export type Role = 'native' | 'learning';
export type LevelCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Native';
export interface UserLanguage { language_code: string; role: Role; level: LevelCode }
export interface Person { id: string; username: string; display_name: string; avatar_url: string | null; bio: string; timezone: string | null; is_private: boolean; followers_count: number; languages: UserLanguage[]; follow_status: 'pending' | 'accepted' | null }
export interface FullProfile extends Omit<Person, 'follow_status'> { following_count: number; relationship: { is_me: boolean; following: 'pending' | 'accepted' | null; follows_me: boolean } }
export interface Message { id: string; conversation_id: string; sender_id: string; body: string; reply_to: string | null; created_at: string; edited_at: string | null; deleted_at: string | null }
/** Row from search_messages: one message inside a chat the viewer belongs to, with both people on it. */
export interface MessageHit {
  message_id: string; conversation_id: string; body: string; created_at: string;
  sender_id: string; sender_name: string; sender_username: string; sender_avatar: string | null;
  other_id: string; other_name: string; other_username: string; other_avatar: string | null;
}
export interface ConversationRow { conversation_id: string; other_user_id: string; other_name: string; other_username: string; other_avatar: string | null; last_body: string | null; last_at: string; unread_count: number; status: 'active' | 'request' | 'ignored' }
export interface LanguageRef { code: string; name: string; native_name: string; rtl: boolean }
export interface MyProfile { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string; timezone: string | null; is_private: boolean; onboarding_done: boolean; role: string; followers_count: number; following_count: number }
export interface Correction { id: string; message_id: string; corrector_id: string; suggested_text: string; note: string | null; status: 'pending' | 'accepted' | 'dismissed'; created_at: string }
export interface SavedPhrase { id: string; phrase: string; translation: string | null; language_code: string | null; source_message_id: string | null; created_at: string }
/** One "Translate" tap, stored forever; source_message_id traces it back to the chat. */
export interface TranslationRecord { id: string; source_text: string; translated_text: string; target_lang: string | null; source_message_id: string | null; created_at: string }
/** Row from list_my_corrections: a correction that was applied to one of my messages. */
export interface CorrectionHistory { id: string; message_id: string; conversation_id: string; original_text: string; suggested_text: string; note: string | null; status: 'pending' | 'accepted' | 'dismissed'; corrector_id: string; corrector_name: string; corrector_username: string; created_at: string }
export interface Reaction { message_id: string; user_id: string; emoji: string }
export type NotificationType = 'follow' | 'follow_request' | 'follow_accepted' | 'message_request' | 'correction';
export interface AppNotification {
  id: string; type: NotificationType; data: { conversation_id?: string; message_id?: string }; read_at: string | null; created_at: string;
  actor_id: string | null; actor_username: string | null; actor_name: string | null; actor_avatar: string | null;
}
export type AccountStatus = 'active' | 'suspended' | 'banned';
export interface ReportEvidence { id: string; sender_id: string; body: string; created_at: string }
export interface AdminReport {
  id: string; reason: string; details: string | null; evidence: ReportEvidence[]; status: 'open' | 'reviewing' | 'actioned' | 'dismissed'; created_at: string; conversation_id: string | null;
  reporter_id: string | null; reporter_username: string | null; reporter_name: string | null;
  target_id: string | null; target_username: string | null; target_name: string | null; target_status: AccountStatus | null; target_open_reports: number;
}
export interface AdminUser { id: string; username: string; display_name: string | null; role: 'user' | 'moderator' | 'admin'; status: AccountStatus; created_at: string; open_reports: number }
export interface AdminAction { id: string; action: 'suspend' | 'ban' | 'reinstate' | 'dismiss_report' | 'auto_suspend'; reason: string | null; created_at: string; admin_name: string | null; target_username: string | null; target_name: string | null }
