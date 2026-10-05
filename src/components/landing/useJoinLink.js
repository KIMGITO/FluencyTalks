import { useAuthStore } from '@/store/authStore';

/**
 * Landing CTAs must never send an already-signed-in member back to /signup.
 * Returns the destination + label for the primary "join us" button so every
 * section (Hero, Cta, Split, About, Languages) behaves identically.
 */
export function useJoinLink() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  // While the session is still resolving, render the neutral guest CTA rather
  // than flashing a "sign up" button at someone who is already signed in.
  if (loading) return { to: '/signup', label: 'Sign up free', signedIn: false };
  if (user) return { to: '/home', label: 'Go to your profile', signedIn: true };
  return { to: '/signup', label: 'Sign up free', signedIn: false };
}
