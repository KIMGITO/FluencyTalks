import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import { Spinner } from '@/components/ui';
import { staffPathFor } from '@/lib/authHelpers';
import Maintenance from '@/pages/public/Maintenance';
import { useAppStatus, useAppStatusStore } from '@/store/appStatusStore';
export function ProtectedRoute() {
  const { user, loading, validateSession, sessionCheckedAt, forceLogoutReason } = useAuthStore();
  const { me, status, load, reset } = useProfileStore(); const loadLanguages = useLanguageStore((s) => s.load); const loc = useLocation();
  const app = useAppStatus();
  useEffect(() => { if (user) void validateSession(); }, [loc.pathname]);
  // Whether a pause applies depends on who is asking.
  useEffect(() => { if (user) void useAppStatusStore.getState().refresh(); }, [user?.id]);
  useEffect(() => { if (user) { load(user.id); loadLanguages(); } else reset(); }, [user?.id]);
  if (user && app?.paused && !app.exempt) return <Maintenance />;
  if (loading || (user && (!app || status !== 'ready'))) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
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
  const staff = !!me && me.role !== 'user'; const onboarded = !!me?.onboarding_done && !!me.native_language_id; const inAdmin = loc.pathname.startsWith('/admin');
  // Staff never get the learner app or its profile setup. The /admin gate decides what they see first.
  if (staff && !inAdmin) return <Navigate to={staffPathFor(loc.pathname, loc.search)} replace />;
  if (!staff && !onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
