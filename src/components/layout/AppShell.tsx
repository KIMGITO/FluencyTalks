import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar'; import { Sidebar } from './Sidebar'; import { RightRail } from './RightRail'; import { BottomNav } from './BottomNav';
import { useChatStore } from '@/store/chatStore';
import { useLanguageStore } from '@/store/languageStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';

export function AppShell() {
  const { startRealtime, stopRealtime } = useChatStore(); const loadLanguages = useLanguageStore((s) => s.load);
  const userId = useAuthStore((s) => s.user?.id); const startNotifications = useNotificationStore((s) => s.start); const stopNotifications = useNotificationStore((s) => s.stop);
  useEffect(() => { loadLanguages(); startRealtime(); return stopRealtime; }, []);
  useEffect(() => { if (!userId) return; startNotifications(userId); return stopNotifications; }, [userId]);
  return (
    <div className="min-h-screen bg-bg">
      <TopBar />
      <div className="ft-shell">
        <Sidebar />
        <main className="mx-auto w-full max-w-[var(--layout-feedMaxW)] py-4 pb-[calc(var(--layout-bottomNavH)+2.5rem+env(safe-area-inset-bottom,0px))] md:px-4 md:py-6 md:pb-8"><Outlet /></main>
        <RightRail />
      </div>
      <BottomNav />
    </div>
  );
}
