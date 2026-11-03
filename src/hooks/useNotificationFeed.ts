import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationLink } from '@/lib/notificationText';
import { deleteNotifications, listNotifications } from '@/services';
import { useInfiniteScroll } from '@/store/feedCache';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from '@/store/toastStore';
import type { AppNotification } from '@/types/db';
import { userMessage } from '@/lib/errors';

const PAGE = 25;

const dayLabel = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

/** The list behind both notification pages: paging, live updates, read and delete. Which tabs it has is up to the page. */
export function useNotificationFeed(category: string | null) {
  const navigate = useNavigate();
  const { unread, markRead, markAllRead, items: live } = useNotificationStore();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const request = useRef(0);

  const first = useCallback(async (quiet = false) => {
    const mine = ++request.current;
    if (!quiet) { setItems(null); setFailed(false); }
    try {
      const rows = await listNotifications(PAGE, null, category);
      if (mine !== request.current) return;   // a newer filter took over
      setItems((old) => {
        // A background refresh keeps the older pages already loaded.
        const tail = quiet && old ? old.filter((o) => !rows.some((r) => r.id === o.id) && rows.length && o.created_at < rows[rows.length - 1].created_at) : [];
        return [...rows, ...tail];
      });
      if (!quiet) setDone(rows.length < PAGE);
    } catch {
      if (mine === request.current && !quiet) setFailed(true);
    }
  }, [category]);
  useEffect(() => { void first(); }, [first]);
  // New ones arrived (the store listens): bring them in without a flash.
  const newest = live[0]?.id;
  useEffect(() => { if (newest) void first(true); }, [newest, first]);

  const more = async () => {
    if (!items?.length || done || loadingMore) return;
    setLoadingMore(true); setMoreFailed(false);
    try {
      const rows = await listNotifications(PAGE, items[items.length - 1].created_at, category);
      setItems((old) => [...(old ?? []), ...rows.filter((r) => !(old ?? []).some((o) => o.id === r.id))]);
      setDone(rows.length < PAGE);
    } catch { setMoreFailed(true); } finally { setLoadingMore(false); }
  };
  const sentinel = useInfiniteScroll(more, !!items && !done && !moreFailed, items?.length ?? 0);

  const open = (n: AppNotification) => {
    if (!n.read_at) {
      setItems((old) => old?.map((o) => (o.id === n.id ? { ...o, read_at: new Date().toISOString() } : o)) ?? old);
      markRead([n.id]).catch(() => undefined);
    }
    navigate(notificationLink(n));
  };
  const toggleRead = async (n: AppNotification) => {
    if (n.read_at) return;
    const stamp = new Date().toISOString();
    setItems((old) => old?.map((o) => (o.id === n.id ? { ...o, read_at: stamp } : o)) ?? old);
    try { await markRead([n.id]); }
    catch (e) { setItems((old) => old?.map((o) => (o.id === n.id ? { ...o, read_at: null } : o)) ?? old); toast.error(userMessage(e)); }
  };
  const remove = async (n: AppNotification) => {
    const before = items;
    setItems((old) => old?.filter((o) => o.id !== n.id) ?? old);
    try { await deleteNotifications([n.id]); void useNotificationStore.getState().load(); }
    catch (e) { setItems(before); toast.error(userMessage(e)); }
  };
  const allRead = async () => {
    setMarkingAll(true);
    const before = items;
    const stamp = new Date().toISOString();
    setItems((old) => old?.map((o) => (o.read_at ? o : { ...o, read_at: stamp })) ?? old);
    try { await markAllRead(); toast.success('All marked as read.'); }
    catch (e) { setItems(before); toast.error(userMessage(e)); }
    finally { setMarkingAll(false); }
  };

  const groups: { label: string; rows: AppNotification[] }[] = [];
  (items ?? []).forEach((n) => {
    const label = dayLabel(n.created_at);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.rows.push(n); else groups.push({ label, rows: [n] });
  });

  return { items, groups, unread, failed, moreFailed, loadingMore, markingAll, sentinel, retry: () => void first(), more, open, toggleRead, remove, allRead };
}
