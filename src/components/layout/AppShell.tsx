import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Toaster } from '@/components/ui';
import { useOnline } from '@/hooks/useOnline';
import { useAccountabilityStore } from '@/store/accountabilityStore';
import { TopBar } from './TopBar'; import { Sidebar } from './Sidebar'; import { RightRail } from './RightRail'; import { BottomNav } from './BottomNav';
import { useChatStore } from '@/store/chatStore';
import { useLanguageStore } from '@/store/languageStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { useHeartbeat } from '@/hooks/usePresence';

export function AppShell() {
  const { startRealtime, stopRealtime } = useChatStore(); const loadLanguages = useLanguageStore((s) => s.load);
  const userId = useAuthStore((s) => s.user?.id); const startNotifications = useNotificationStore((s) => s.start); const stopNotifications = useNotificationStore((s) => s.stop);
  useHeartbeat();
  const { pathname } = useLocation();
  const online = useOnline();
  const loadAccountability = useAccountabilityStore((s) => s.load);
  useEffect(() => { if (userId) void loadAccountability(); }, [userId, loadAccountability]);
  useEffect(() => { loadLanguages(); startRealtime(); return stopRealtime; }, []);
  useEffect(() => { if (!userId) return; startNotifications(userId); return stopNotifications; }, [userId]);
  return (
    <div className="min-h-screen bg-bg">
      <ScrollRestoration />
      <TopBar />
      {!online && <p role="status" className="flex items-center justify-center gap-2 bg-deep px-3 py-1.5 text-xs font-semibold text-on-deep"><WifiOff size={14} aria-hidden /> You're offline. What you've already opened is still here; changes need a connection.</p>}
      <div className="ft-shell">
        <Sidebar />
        <main className="mx-auto w-full max-w-[var(--layout-feedMaxW)] py-4 pb-[calc(var(--layout-bottomNavH)+2.5rem+env(safe-area-inset-bottom,0px))] md:px-4 md:py-6 md:pb-8"><div key={pathname.split('/').slice(0, 3).join('/')} className="ft-page"><Outlet /></div></main>
        <RightRail />
      </div>
      <BottomNav />
      <Toaster />
    </div>
  );
}
