import { useAuthStore } from '@/store/authStore';


export function useProviderAvatar(): string | null {
  const user = useAuthStore((s) => s.user);
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const url = meta.avatar_url ?? meta.picture ?? meta.profile_picture ?? null;
  return typeof url === 'string' && url ? url : null;
}


export function resolveAvatar(profileUrl?: string | null, providerUrl?: string | null): string | null {
  return profileUrl || providerUrl || null;
}