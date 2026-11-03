import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getPresence, touchPresence, type Seen } from '@/services/presence';
import { useProfileStore } from '@/store/profileStore';

const BEAT_MS = 30_000;     // the server calls you online for 70 seconds after a beat
const POLL_MS = 30_000;
const IDLE_MS = 5 * 60_000;   // an open tab nobody is using does not count as online
const TYPING_SEND_MS = 2_000;
const TYPING_SHOW_MS = 4_000;

/** Tells the server I'm here while the tab is visible and in use. Mounted once, in AppShell. */
export function useHeartbeat() {
  const show = useProfileStore((s) => s.me?.show_activity !== false);
  const ready = useProfileStore((s) => !!s.me);
  useEffect(() => {
    if (!ready || !show) return;
    let lastUse = Date.now();
    let lastBeat = 0;
    const beat = () => {
      if (document.hidden || Date.now() - lastUse > IDLE_MS) return;
      lastBeat = Date.now();
      touchPresence().catch(() => undefined);
    };
    const used = () => {
      lastUse = Date.now();
      if (lastUse - lastBeat >= BEAT_MS) beat();   // back from idle: online straight away
    };
    const onVisible = () => { if (!document.hidden) used(); };
    beat();
    const timer = setInterval(beat, BEAT_MS);
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, used, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, used, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, show]);
}

// One poll for the whole app, however many cards and chats are on screen.
const watching = new Map<string, number>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let soon: ReturnType<typeof setTimeout> | null = null;

const usePresenceStore = create<{ seen: Record<string, Seen> }>(() => ({ seen: {} }));

const poll = async () => {
  const ids = [...watching.keys()];
  if (!ids.length || document.hidden) return;
  const rows = await getPresence(ids).catch(() => null);
  if (!rows) return;
  const seen: Record<string, Seen> = {};
  rows.forEach((r) => { seen[r.user_id] = r; });
  usePresenceStore.setState({ seen });
};
const onVisible = () => { if (!document.hidden) void poll(); };
const watch = (ids: string[]) => {
  ids.forEach((id) => watching.set(id, (watching.get(id) ?? 0) + 1));
  if (!pollTimer) {
    pollTimer = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  if (soon) clearTimeout(soon);
  soon = setTimeout(poll, 100);   // a list of cards mounting at once asks once
  return () => {
    ids.forEach((id) => {
      const n = (watching.get(id) ?? 1) - 1;
      if (n > 0) watching.set(id, n); else watching.delete(id);
    });
    if (!watching.size && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
};

/** What I may know about these people. Someone missing has hidden it, or was never here. */
export function usePresenceOf(ids: (string | null | undefined)[]): Record<string, Seen> {
  const key = ids.filter(Boolean).sort().join(',');
  useEffect(() => (key ? watch(key.split(',')) : undefined), [key]);
  const seen = usePresenceStore((s) => s.seen);
  return useMemo(() => {
    const out: Record<string, Seen> = {};
    key.split(',').forEach((id) => { if (seen[id]) out[id] = seen[id]; });
    return out;
  }, [seen, key]);
}

/** Typing in one chat. Goes straight between the two browsers; nothing is stored. Private: the database checks you're in the chat. */
export function useTyping(convId: string | null, myId: string | null) {
  const [peerTyping, setPeerTyping] = useState(false);
  const sendRef = useRef<(typing: boolean) => void>(() => undefined);
  const clearRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    setPeerTyping(false);
    sendRef.current = () => undefined;
    clearRef.current = () => undefined;
    if (!convId || !myId) return;
    const ch = supabase.channel(`ft-chat:${convId}`, { config: { private: true } });
    let hide: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { clearTimeout(hide); setPeerTyping(false); };
    ch.on('broadcast', { event: 'typing' }, (p) => {
      const { user_id, typing } = (p.payload ?? {}) as { user_id?: string; typing?: boolean };
      if (!user_id || user_id === myId) return;
      if (typing === false) return clear();
      setPeerTyping(true);
      clearTimeout(hide);
      hide = setTimeout(() => setPeerTyping(false), TYPING_SHOW_MS);   // their tab may close mid-word
    });
    ch.subscribe();
    let lastSent = 0;
    sendRef.current = (typing) => {
      const now = Date.now();
      if (typing && now - lastSent < TYPING_SEND_MS) return;
      if (!typing && !lastSent) return;
      lastSent = typing ? now : 0;
      void ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing } });
    };
    clearRef.current = clear;
    return () => { clearTimeout(hide); supabase.removeChannel(ch); };
  }, [convId, myId]);

  return {
    peerTyping,
    /** Call as the text changes: true while there is text, false once it's sent or cleared. */
    setTyping: (typing: boolean) => sendRef.current(typing),
    /** Their message arrived, so they have stopped. */
    clearPeerTyping: () => clearRef.current(),
  };
}
