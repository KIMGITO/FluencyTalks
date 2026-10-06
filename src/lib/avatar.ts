import { useAuthStore } from '@/store/authStore';

/** Auth provider image (Google etc) from the live session's user_metadata. */
export function useProviderAvatar(): string | null {
  const user = useAuthStore((s) => s.user);
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const url = meta.avatar_url ?? meta.picture ?? meta.profile_picture ?? null;
  return typeof url === 'string' && url ? url : null;
}

/** Best avatar: explicit profile photo first, then provider image, else null (initials). */
export function resolveAvatar(profileUrl?: string | null, providerUrl?: string | null): string | null {
  return profileUrl || providerUrl || null;
}