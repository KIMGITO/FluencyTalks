import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LogOut, Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog } from '@/components/ui';
import { deleteAccount } from '@/services';
import { useAuthStore } from '@/store/authStore';

/** End of the profile and settings pages: a calm log-out row, then a clearly separated danger zone. */
export function AccountZone() {
  const signOut = useAuthStore((s) => s.signOut);
  const email = useAuthStore((s) => s.user?.email);
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Account" className="flex flex-col gap-3">
      <Card className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink"><LogOut size={18} aria-hidden /></span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">Log out</p>
            <p className="truncate text-xs text-muted">{email ? `Signed in as ${email}` : 'Sign out on this device'}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={signOut}>Log out</Button>
      </Card>

      <Card className="border-danger/40 bg-danger/[0.04]">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-danger"><AlertTriangle size={16} aria-hidden /> Danger zone</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">Delete account</p>
            <p className="text-sm text-muted">
              Permanently removes your account, messages and profile. <Link to="/data-deletion" className="font-medium text-ink underline">How deletion works</Link>
            </p>
          </div>
          <Button variant="danger" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden /> Delete account</Button>
        </div>
      </Card>

      <ConfirmDialog open={confirming} danger title="Delete your account?" confirmLabel="Delete forever"
        onClose={() => setConfirming(false)} onConfirm={async () => { await deleteAccount(); await signOut(); }}>
        Your profile, messages, contributions and points will be removed. This can't be undone.
      </ConfirmDialog>
    </section>
  );
}
