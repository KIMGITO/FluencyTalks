import { rpc } from '@/lib/api';
import type { CorrectionStatus } from '@/types/db';

export interface OpenBounty {
  message_id: string; body: string; language_id: string; cost: number; expires_at: string; created_at: string;
  asker_id: string; asker_username: string | null; asker_display_name: string | null; asker_avatar_url: string | null;
  /** Answers waiting for the asker's decision. */
  answers: number;
  /** Set only when you are in that chat yourself. */
  conversation_id: string | null;
}

export type BountyStatus = 'open' | 'paid' | 'refunded';

export interface MyBounty {
  message_id: string; conversation_id: string; body: string; language_id: string | null; cost: number;
  status: BountyStatus; expires_at: string; created_at: string; answers: number;
  paid_to_username: string | null; paid_to_name: string | null;
}

/** An answer I sent to someone's bounty, and what happened to it. */
export interface MyBountyAnswer {
  correction_id: string; message_id: string; original: string; suggested_text: string; note: string | null;
  status: CorrectionStatus; decision_note: string | null; decided_at: string | null; created_at: string; language_id: string | null;
  bounty_status: BountyStatus; cost: number; expires_at: string; paid_to_me: boolean;
  asker_username: string | null; asker_display_name: string | null; asker_avatar_url: string | null; conversation_id: string | null;
}

export const BOUNTY_PAGE = 20;
export const listOpenBounties = (offset = 0, limit = BOUNTY_PAGE) => rpc<OpenBounty[]>('list_open_bounties', { p_limit: limit, p_offset: offset });
export const listMyBounties = () => rpc<MyBounty[]>('list_my_bounties');
export const listMyBountyAnswers = () => rpc<MyBountyAnswer[]>('list_my_bounty_answers');
export const answerBounty = (messageId: string, text: string, note?: string) =>
  rpc<string>('answer_bounty', { p_message: messageId, p_text: text, p_note: note?.trim() || null });
