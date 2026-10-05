import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Presence via Supabase Realtime (no DB columns, no migration).
 * - Lobby channel `ft-presence`: I broadcast { user_id, at } every 20s + on
 *   connect; everyone tracks the channel so `onlineIds` = users seen in last 45s.
 * - Per-chat channel `ft-chat:<convId>`: both members track + broadcast
 *   `typing` events; `peerTyping` is true while the other side typed <3s ago.
 * Call `touchTyping()` on composer input/change.
 */
export function usePresence(convId: string | null, peerId: string | null, myId: string | null) {
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const touchRef = useRef<() => void>(() => undefined);
  const touchTyping = () => touchRef.current();

  useEffect(() => {
    if (!myId) return;
    const lobby = supabase.channel('ft-presence', { config: { presence: { key: myId } } });
    const readOnline = () => {
      const now = Date.now();
      const ids = new Set<string>();
      // Shape: { <presenceKey>: [{ user_id, at }, ...] } — presence key IS the user id.
      const state = lobby.presenceState<{ user_id: string; at: number }>() as Record<string, { user_id: string; at: number }[]>;
      for (const [key, metas] of Object.entries(state)) {
        for (const p of metas ?? []) {
          if (now - (p?.at ?? 0) < 45_000) ids.add(p?.user_id ?? key);
        }
      }
      setOnlineIds([...ids]);
    };
    lobby
      .on('presence', { event: 'sync' }, readOnline)
      .on('presence', { event: 'join' }, readOnline)
      .on('presence', { event: 'leave' }, readOnline)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await lobby.track({ user_id: myId, at: Date.now() });
          readOnline();
        }
      });
    const beat = setInterval(() => { lobby.track({ user_id: myId, at: Date.now() }); }, 20_000);
    return () => { clearInterval(beat); supabase.removeChannel(lobby); };
  }, [myId]);

  useEffect(() => {
    setPeerTyping(false);
    touchRef.current = () => undefined;
    if (!convId || !myId || !peerId) return;
    const ch = supabase.channel(`ft-chat:${convId}`, { config: { presence: { key: myId } } });
    let timer: ReturnType<typeof setTimeout> | 0 = 0;
    const poke = () => {
      setPeerTyping(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPeerTyping(false), 3_000);   // stale guard if stop event is lost
    };
    ch.on('broadcast', { event: 'typing' }, (p) => {
      const from = (p.payload as { user_id?: string } | undefined)?.user_id;
      if (from && from !== myId) poke();
    });
    ch.subscribe();
    let last = 0;
    touchRef.current = () => {
      const now = Date.now();
      if (now - last < 1_500) return;   // throttle: max one broadcast per 1.5s while typing
      last = now;
      ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId } });
    };
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  }, [convId, myId, peerId]);

  return { onlineIds, peerTyping, touchTyping };
}
