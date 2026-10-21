import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import { Spinner } from '@/components/ui';
/** Requires login, loads the profile, and sends new users through onboarding first. */
export function ProtectedRoute() {
  const { user, loading, validateSession, sessionCheckedAt, forceLogoutReason } = useAuthStore();
  const { me, status, load, reset } = useProfileStore(); const loadLanguages = useLanguageStore((s) => s.load); const loc = useLocation();
  // Always re-confirm the session when entering protected screens: a device whose
  // account was deleted elsewhere (or re-created with the same email) must not
  // reuse its stale session — it is forced back to login instead.
  useEffect(() => { if (user) void validateSession(); }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) { load(user.id); loadLanguages(); } else reset(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    void sessionCheckedAt; // subscribed so the banner reason re-renders after async logout
    return <Navigate to="/login" state={{ from: loc, reason }} replace />;
  }
  if ((!me?.onboarding_done || !me.native_language_id) && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
