import { Navigate } from 'react-router-dom';
import { useProfileStore } from '@/store/profileStore';
export default function Profile() {
  const username = useProfileStore((s) => s.me?.username);
  return <Navigate to={username ? `/u/${username}` : '/onboarding'} replace />;
}
