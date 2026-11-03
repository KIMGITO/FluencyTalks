import { RefreshCw } from 'lucide-react';
import { AuthLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAppStatusStore } from '@/store/appStatusStore';
import { useAuthStore } from '@/store/authStore';

/** What everyone but staff sees while the app is paused. */
export default function Maintenance() {
  const message = useAppStatusStore((s) => s.status?.message);
  const refresh = useAppStatusStore((s) => s.refresh);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const check = useAction(refresh, { silent: true });
  return (
    <AuthLayout title="We'll be back soon">
      <div role="status" className="space-y-4">
        <p>{message || "The Fluency Talks is paused for a short while. Your account and your messages are safe, and you don't need to do anything."}</p>
        <div className="flex flex-wrap gap-2">
          <Button loading={check.busy} onClick={() => void check.run()}><RefreshCw size={15} aria-hidden /> Check again</Button>
          {user && <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>}
        </div>
      </div>
    </AuthLayout>
  );
}
