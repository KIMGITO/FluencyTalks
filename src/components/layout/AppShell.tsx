import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar'; import { Sidebar } from './Sidebar'; import { RightRail } from './RightRail'; import { BottomNav } from './BottomNav';
import { useChatStore } from '@/store/chatStore';
import { useLanguageStore } from '@/store/languageStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
/** Facebook-style shell. Grid columns are controlled in styles/index.css (.ft-shell) from tokens. */
export function AppShell() {
  const { startRealtime, stopRealtime } = useChatStore(); const loadLanguages = useLanguageStore((s) => s.load);
  const userId = useAuthStore((s) => s.user?.id); const startNotifications = useNotificationStore((s) => s.start); const stopNotifications = useNotificationStore((s) => s.stop);
  useEffect(() => { loadLanguages(); startRealtime(); return stopRealtime; }, []);
  useEffect(() => { if (!userId) return; startNotifications(userId); return stopNotifications; }, [userId]);
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="ft-shell">
        <Sidebar />
        <main className="mx-auto w-full max-w-[var(--layout-feedMaxW)] px-3 py-4 pb-24 md:px-4 md:pb-8"><Outlet /></main>
        <RightRail />
      </div>
      <BottomNav />
    </div>
  );
}
