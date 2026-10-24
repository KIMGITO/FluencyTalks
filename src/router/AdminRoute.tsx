import { Navigate, Outlet } from 'react-router-dom';
import { useProfileStore } from '@/store/profileStore';

export function AdminRoute() {
  const role = useProfileStore((s) => s.me?.role);
  return role === 'admin' || role === 'moderator' ? <Outlet /> : <Navigate to="/home" replace />;
}
