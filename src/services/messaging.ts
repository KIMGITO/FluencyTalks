import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { ConversationRow, Correction, Message, Reaction } from '@/types/db';


/** The other member's last_read_at: my messages at or before it have been read. Null when unknown. */
export async function getPeerReadAt(conv: string): Promise<string | null> {
  const { data } = await supabase.rpc('peer_read_at', { p_conv: conv });
  return (data as string | null) ?? null;
}

/** Live peer read receipts: fires when the other member opens this chat (their last_read_at moves). */
export function subscribeToReceipts(conv: string, onRead: (at: string) => void) {
  const ch = supabase.channel(`receipts:${conv}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conv}` }, (p) => {
      const row = p.new as { user_id?: string; last_read_at?: string };
      if (row?.last_read_at) onRead(row.last_read_at);
    })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export const startConversation = (userId: string) => rpc<string>('start_conversation', { p_target: userId });
export const sendMessage = (conv: string, body: string, replyTo?: string) => rpc<Message>('send_message', { p_conv: conv, p_body: body, p_reply_to: replyTo ?? null });
export const listConversations = (status: 'active' | 'request' = 'active') => rpc<ConversationRow[]>('list_conversations', { p_status: status });
export const respondMessageRequest = (conv: string, accept: boolean) => rpc('respond_message_request', { p_conv: conv, p_accept: accept });
export const markRead = (conv: string) => rpc('mark_read', { p_conv: conv });
export const editMessage = (id: string, body: string) => rpc('edit_message', { p_id: id, p_body: body });
export const deleteMessage = (id: string) => rpc('delete_message', { p_id: id });
export const toggleReaction = (messageId: string, emoji: string) => rpc<boolean>('toggle_reaction', { p_message: messageId, p_emoji: emoji });
export const suggestCorrection = (messageId: string, text: string, note?: string) => rpc<string>('suggest_correction', { p_message: messageId, p_text: text, p_note: note ?? null });
export const acceptCorrection = (id: string) => rpc('accept_correction', { p_id: id });
export const respondCorrection = (id: string, accept: boolean) => rpc('respond_correction', { p_id: id, p_accept: accept });

/** Newest-first page of messages (RLS guarantees only members see them). Pass the oldest created_at to page back. */
export async function getMessages(conv: string, before?: string, limit = 40) {
  let q = supabase.from('messages').select('*').eq('conversation_id', conv).order('created_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('created_at', before);
  return ((await q).data ?? []) as Message[];
}

/** The ONLY place that uses Supabase Realtime. Replace with WebSocket/Ably later without touching UI code. */
export function subscribeToConversation(conv: string, onMessage: (m: Message) => void) {
  const ch = supabase.channel(`conv:${conv}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv}` }, (p) => onMessage(p.new as Message))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/** Corrections for a set of messages (RLS: only visible if I can see the message). */
export async function getCorrections(messageIds: string[]) {
  if (!messageIds.length) return [] as Correction[];
  return ((await supabase.from('message_corrections').select('*').in('message_id', messageIds)).data ?? []) as Correction[];
}

/** Reactions for a set of messages (RLS: only visible if I can see the message). */
export async function getReactions(messageIds: string[]) {
  if (!messageIds.length) return [] as Reaction[];
  return ((await supabase.from('message_reactions').select('*').in('message_id', messageIds)).data ?? []) as Reaction[];
}
export interface ReactionEvent { added: boolean; reaction: Reaction }

/** Everything I'm allowed to see arrives on one channel (RLS filters by membership and blocks).
 *  Realtime, part 1 of 2 (the other is services/notifications.ts). Reaction DELETE events carry only the primary key (message, user, emoji), which is all we need. */
export function subscribeToInbox(onMessage: (m: Message) => void, onCorrection?: (c: Correction) => void, onReaction?: (e: ReactionEvent) => void, onUpdate?: (m: Message) => void) {
  const ch = supabase.channel('inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onMessage(p.new as Message))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => { (onUpdate ?? onMessage)(p.new as Message); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_corrections' }, (p) => { if (p.eventType !== 'DELETE') onCorrection?.(p.new as Correction); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (p) => onReaction?.({ added: true, reaction: p.new as Reaction }))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (p) => onReaction?.({ added: false, reaction: p.old as Reaction }))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
