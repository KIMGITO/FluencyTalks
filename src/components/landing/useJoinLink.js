import { useAuthStore } from '@/store/authStore';


export function useJoinLink() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  
  
  if (loading) return { to: '/signup', label: 'Sign up free', signedIn: false };
  if (user) return { to: '/home', label: 'Go to your profile', signedIn: true };
  return { to: '/signup', label: 'Sign up free', signedIn: false };
}
