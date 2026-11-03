import { useState } from 'react';
import { CirclePause, CirclePlay, Power, TriangleAlert } from 'lucide-react';
import { Button, Card, ConfirmDialog, Input } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { useAppStatusStore } from '@/store/appStatusStore';
import { toast } from '@/store/toastStore';
import { Chip, IconTile } from './AdminKit';

/** The emergency switch. The database refuses this from anyone below admin, or without an authenticator code. */
export function SiteStatusPanel() {
  const status = useAppStatusStore((s) => s.status);
  const setPaused = useAppStatusStore((s) => s.setPaused);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  if (!status) return null;
  const { paused } = status;
  return (
    <section aria-labelledby="site-status" className="space-y-2">
      <h2 id="site-status" className="ft-inset font-display text-xl font-medium">Site status</h2>
      <Card className="flex flex-wrap items-center gap-3">
        <IconTile icon={paused ? CirclePause : Power} tone={paused ? 'danger' : 'success'} />
        <span className="min-w-[14rem] flex-1 text-sm">
          <span className="flex flex-wrap items-center gap-2"><b>{paused ? 'Paused for users' : 'Live for everyone'}</b><Chip tone={paused ? 'danger' : 'success'}>{paused ? 'Down' : 'Up'}</Chip></span>
          <span className="mt-0.5 block text-muted">{paused
            ? `Since ${status.since ? formatTime(status.since) : 'just now'}. Only staff can use the app.`
            : 'If you are facing an attack or a data problem, pause the app. Staff keep working.'}</span>
        </span>
        <Button variant={paused ? 'primary' : 'danger'} size="sm" onClick={() => { setMessage(''); setConfirming(true); }}>
          {paused ? <><CirclePlay size={15} aria-hidden /> Bring the app back</> : <><CirclePause size={15} aria-hidden /> Pause the app</>}
        </Button>
        {status.enforced === false && (
          <p role="alert" className="flex w-full items-start gap-2 text-sm text-danger"><TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" /> The API isn't connected to this switch, so pausing won't stop anyone. See docs/SECURITY.md.</p>
        )}
      </Card>
      <ConfirmDialog
        open={confirming} onClose={() => setConfirming(false)} danger={!paused}
        title={paused ? 'Bring the app back?' : 'Pause the app for all users?'}
        confirmLabel={paused ? 'Bring it back' : 'Pause the app'}
        reasonLabel={paused ? 'Why is it safe now? (kept in the audit log)' : 'What is happening? (kept in the audit log, users never see it)'} reasonRequired
        onConfirm={async (reason) => {
          await setPaused(!paused, reason, message.trim());
          toast.success(paused ? 'The app is back on for everyone.' : 'The app is paused. Only staff can use it now.');
        }}>
        {paused ? <p>Everyone can use the app again, and open tabs reload by themselves. Decision deadlines move forward by the time it was down.</p> : (
          <div className="space-y-3">
            <p>Every user is stopped straight away, including anyone with the app open: no reading, posting, messages or uploads, and no new accounts. The public website stays up.</p>
            <Input label="Message for users (optional)" maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="We'll be back soon." />
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
