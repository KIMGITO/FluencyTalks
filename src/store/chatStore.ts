import { create } from 'zustand';
import { acceptCorrection, deleteMessage, getCorrections, getMessages, getReactions, listConversations, markRead, respondCorrection, respondMessageRequest, sendMessage, subscribeToInbox, suggestCorrection, toggleReaction, type ReactionEvent } from '@/services';
import { useAuthStore } from '@/store/authStore';
import type { ConversationRow, Correction, Message, Reaction } from '@/types/db';

let unsub: (() => void) | null = null;

const loadJson = (key: string): Record<string, string[]> | Record<string, true> => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};
const saveJson = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

interface S {
  active: ConversationRow[]; requests: ConversationRow[]; openId: string | null;
  messages: Record<string, Message[]>; corrections: Record<string, Correction[]>; reactions: Record<string, Reaction[]>; // corrections and reactions keyed by message id
  pins: Record<string, string[]>; hidden: Record<string, true>; drafts: Record<string, Message | null>;
  loadLists: () => Promise<void>; open: (id: string) => Promise<void>; close: () => void;
  send: (id: string, body: string, replyTo?: string) => Promise<void>; respond: (id: string, accept: boolean) => Promise<void>;
  loadCorrections: (convId: string) => Promise<void>; upsertCorrection: (c: Correction) => void;
  suggest: (convId: string, messageId: string, text: string, note?: string) => Promise<void>;
  accept: (c: Correction) => Promise<void>; dismiss: (c: Correction) => Promise<void>;
  loadReactions: (convId: string) => Promise<void>; applyReaction: (e: ReactionEvent) => void; react: (messageId: string, emoji: string) => Promise<void>;
  startRealtime: () => void; stopRealtime: () => void; append: (m: Message) => void; applyUpdate: (m: Message) => void;
  togglePin: (convId: string, messageId: string) => void; isPinned: (convId: string, messageId: string) => boolean;
  hideForMe: (messageId: string) => void;
  deleteForEveryone: (convId: string, messageId: string) => Promise<void>;
  setReply: (convId: string, m: Message | null) => void;
}
export const useChatStore = create<S>((set, get) => ({
  active: [], requests: [], messages: {}, corrections: {}, reactions: {}, openId: null,
  pins: loadJson('ft-pins') as Record<string, string[]>,
  hidden: loadJson('ft-hidden') as Record<string, true>,
  drafts: {},
  loadLists: async () => { const [active, requests] = await Promise.all([listConversations('active'), listConversations('request')]); set({ active, requests }); },
  open: async (id) => {
    set({ openId: id });
    await get().loadLists();                                   // lists first so the header never flashes "unavailable"
    const list = (await getMessages(id)).reverse();            // API is newest-first; UI wants oldest-first
    set((s) => ({ messages: { ...s.messages, [id]: list } }));
    await Promise.all([get().loadCorrections(id), get().loadReactions(id), markRead(id)]); await get().loadLists();
  },
  close: () => set({ openId: null }),
  send: async (id, body, replyTo) => {
    const fallback = get().drafts[id]?.id ?? undefined;
    get().append(await sendMessage(id, body, replyTo ?? fallback));
    set((s) => ({ drafts: { ...s.drafts, [id]: null } }));
    await get().loadLists();
  },
  respond: async (id, accept) => { await respondMessageRequest(id, accept); await get().loadLists(); },
  append: (m) => set((s) => {
    const list = s.messages[m.conversation_id];
    if (!list) return s;                                       // not opened yet: lists refresh via loadLists()
    return list.some((x) => x.id === m.id) ? s : { messages: { ...s.messages, [m.conversation_id]: [...list, m] } };
  }),
  /** INSERT and UPDATE (delete-for-everyone) both land here; id-keyed upsert. */
  applyUpdate: (m) => set((s) => {
    const list = s.messages[m.conversation_id];
    if (!list) return s;
    return { messages: { ...s.messages, [m.conversation_id]: list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m] } };
  }),
  loadCorrections: async (convId) => {
    const rows = await getCorrections((get().messages[convId] ?? []).map((m) => m.id));
    const byMessage: Record<string, Correction[]> = {}; rows.forEach((r) => (byMessage[r.message_id] ??= []).push(r));
    set((s) => ({ corrections: { ...s.corrections, ...byMessage } }));
  },
  upsertCorrection: (c) => set((s) => {
    const list = s.corrections[c.message_id] ?? [];
    const next = list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c];
    return { corrections: { ...s.corrections, [c.message_id]: next } };
  }),
  suggest: async (convId, messageId, text, note) => { await suggestCorrection(messageId, text, note); await get().loadCorrections(convId); },
  accept: async (c) => { await acceptCorrection(c.id); get().upsertCorrection({ ...c, status: 'accepted' }); },   // also saves the phrase (server-side)
  dismiss: async (c) => { await respondCorrection(c.id, false); get().upsertCorrection({ ...c, status: 'dismissed' }); },
  loadReactions: async (convId) => {
    const rows = await getReactions((get().messages[convId] ?? []).map((m) => m.id));
    const byMessage: Record<string, Reaction[]> = {}; (get().messages[convId] ?? []).forEach((m) => (byMessage[m.id] = []));   // empty list clears reactions removed while away
    rows.forEach((r) => byMessage[r.message_id]?.push(r));
    set((s) => ({ reactions: { ...s.reactions, ...byMessage } }));
  },
  /** Used by both my own taps and realtime events; idempotent, so the echo of my own change is harmless. */
  applyReaction: ({ added, reaction: r }) => set((s) => {
    const list = s.reactions[r.message_id] ?? []; const same = (x: Reaction) => x.user_id === r.user_id && x.emoji === r.emoji;
    if (added) return list.some(same) ? s : { reactions: { ...s.reactions, [r.message_id]: [...list, r] } };
    return list.some(same) ? { reactions: { ...s.reactions, [r.message_id]: list.filter((x) => !same(x)) } } : s;
  }),
  react: async (messageId, emoji) => {
    const me = useAuthStore.getState().user!.id;
    const mine = (get().reactions[messageId] ?? []).filter((r) => r.user_id === me);
    if (mine.some((r) => r.emoji === emoji)) {
      const added = await toggleReaction(messageId, emoji);
      get().applyReaction({ added, reaction: { message_id: messageId, user_id: me, emoji } });
      return;
    }
    // Single-reaction enforcement: clear my previous emoji first so counts stay in sync.
    for (const old of mine) {
      try {
        const removed = await toggleReaction(messageId, old.emoji);
        if (!removed) get().applyReaction({ added: false, reaction: old });
      } catch { /* keep going: replacement must not fail because one removal did */ }
    }
    const added = await toggleReaction(messageId, emoji);   // server decides: true = added, false = removed
    get().applyReaction({ added, reaction: { message_id: messageId, user_id: me, emoji } });
  },
  togglePin: (convId, messageId) => set((s) => {
    const cur = s.pins[convId] ?? [];
    const pins = { ...s.pins, [convId]: cur.includes(messageId) ? cur.filter((x) => x !== messageId) : [...cur, messageId] };
    saveJson('ft-pins', pins);
    return { pins };
  }),
  isPinned: (convId, messageId) => (get().pins[convId] ?? []).includes(messageId),
  /** Delete-for-me: local-only visibility filter, keyed by message id. */
  hideForMe: (messageId) => set((s) => {
    const hidden = { ...s.hidden, [messageId]: true as const };
    saveJson('ft-hidden', hidden);
    return { hidden };
  }),
  /** Delete-for-everyone: server mutates body -> '[deleted]'; bubble stays as placeholder. */
  deleteForEveryone: async (convId, messageId) => {
    await deleteMessage(messageId);
    const cur = (get().messages[convId] ?? []).find((m) => m.id === messageId);
    if (cur) get().applyUpdate({ ...cur, body: '[deleted]', deleted_at: new Date().toISOString() });
  },
  setReply: (convId, m) => set((s) => ({ drafts: { ...s.drafts, [convId]: m } })),
  startRealtime: () => {
    if (unsub) return;
    get().loadLists();
    unsub = subscribeToInbox(
      (m) => { get().append(m); if (get().openId === m.conversation_id) markRead(m.conversation_id); get().loadLists(); },
      (c) => get().upsertCorrection(c),
      (e) => get().applyReaction(e),
      (m) => get().applyUpdate(m));
  },
  stopRealtime: () => { unsub?.(); unsub = null; set({ active: [], requests: [], messages: {}, corrections: {}, reactions: {}, openId: null }); },
}));
