import { Navigate, Outlet } from 'react-router-dom';
import { useProfileStore } from '@/store/profileStore';
/** Hides the admin screens from everyone else. This is only a convenience: every admin function re-checks the role on the server. */
export function AdminRoute() {
  const role = useProfileStore((s) => s.me?.role);
  return role === 'admin' || role === 'moderator' ? <Outlet /> : <Navigate to="/home" replace />;
}
