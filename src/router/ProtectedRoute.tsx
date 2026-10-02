import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useLanguageStore } from '@/store/languageStore';
import { Spinner } from '@/components/ui';
/** Requires login, loads the profile, and sends new users through onboarding first. */
export function ProtectedRoute() {
  const { user, loading } = useAuthStore(); const { me, status, load, reset } = useProfileStore(); const loadLanguages = useLanguageStore((s) => s.load); const loc = useLocation();
  useEffect(() => { if (user) { load(user.id); loadLanguages(); } else reset(); }, [user?.id]);
  if (loading || (user && status !== 'ready')) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!me?.onboarding_done && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
