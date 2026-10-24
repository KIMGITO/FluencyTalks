import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import { Spinner } from '@/components/ui';
export function ProtectedRoute() {
  const { user, loading, validateSession, sessionCheckedAt, forceLogoutReason } = useAuthStore();
  const { me, status, load, reset } = useProfileStore(); const loadLanguages = useLanguageStore((s) => s.load); const loc = useLocation();
  useEffect(() => { if (user) void validateSession(); }, [loc.pathname]);
  useEffect(() => { if (user) { load(user.id); loadLanguages(); } else reset(); }, [user?.id]);
  if (loading || (user && status !== 'ready')) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
  if (!user) {
    const reason =
      forceLogoutReason === 'idle'
        ? 'You were signed out after 24 hours of inactivity. Please log in again.'
        : forceLogoutReason === 'invalid'
          ? 'Your session is no longer valid. Please log in again.'
          : forceLogoutReason === 'switched'
            ? 'This account was recreated. Please log in again to continue.'
            : undefined;
    void sessionCheckedAt;
    return <Navigate to="/login" state={{ from: loc, reason }} replace />;
  }
  if ((!me?.onboarding_done || !me.native_language_id) && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
