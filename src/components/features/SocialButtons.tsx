import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
export function SocialButtons() {
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider);
  return (
    <div className="grid gap-2">
      <Button variant="secondary" full onClick={() => signInWithProvider('google')}>Continue with Google</Button>
      <Button variant="secondary" full onClick={() => signInWithProvider('apple')}>Continue with Apple</Button>
      <Button variant="secondary" full onClick={() => signInWithProvider('facebook')}>Continue with Facebook</Button>
    </div>
  );
}
