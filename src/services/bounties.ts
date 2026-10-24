import { rpc } from '@/lib/api';

/** A bounty from someone else that I am qualified to answer. */
export interface OpenBounty {
  message_id: string; body: string; language_id: string; cost: number; expires_at: string; created_at: string;
  asker_id: string; asker_username: string | null; asker_display_name: string | null; asker_avatar_url: string | null;
}
/** A bounty I posted. */
export interface MyBounty {
  message_id: string; conversation_id: string; body: string; language_id: string | null; cost: number;
  status: 'open' | 'paid' | 'refunded'; expires_at: string; created_at: string; answers: number;
}

export const listOpenBounties = (limit = 20) => rpc<OpenBounty[]>('list_open_bounties', { p_limit: limit });
export const listMyBounties = () => rpc<MyBounty[]>('list_my_bounties');
export const answerBounty = (messageId: string, text: string, note?: string) =>
  rpc<string>('answer_bounty', { p_message: messageId, p_text: text, p_note: note?.trim() || null });
