import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { toast } from '@/store/toastStore';

const usePush = () => {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')); }, []);
  const turnOn = useAction(enablePush, {
    onDone: async (granted) => {
      setState(await pushState());
      if (granted) toast.success('Push is on for this device.');
      else toast.info('Not turned on. Your browser needs your permission first.');
    },
  });
  const turnOff = useAction(disablePush, { success: 'Push is off for this device.', onDone: async () => setState(await pushState()) });
  return { state, turnOn, turnOff };
};

/** The setting, in the Notifications page's settings panel. */
export function PushToggle() {
  const { state, turnOn, turnOff } = usePush();
  if (!state || state === 'unconfigured') return null;
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-2 text-sm">
      <span className="min-w-0 flex-1 basis-48">
        <span className="font-semibold">Push on this device</span>
        <span className="block text-xs text-muted">
          {state === 'on' && 'Notifications reach you here when the app is closed.'}
          {state === 'off' && 'Get notifications here when the app is closed. This uses the settings below.'}
          {state === 'blocked' && "Your browser is blocking notifications from this site. Allow them in the site's settings, then come back."}
          {state === 'needs-install' && 'On iPhone, add this app to your Home Screen first (Share, then Add to Home Screen).'}
          {state === 'unsupported' && "This browser doesn't support push."}
        </span>
      </span>
      {state === 'on' && <Button size="sm" variant="secondary" loading={turnOff.busy} onClick={() => void turnOff.run()}>Turn off</Button>}
      {state === 'off' && <Button size="sm" variant="secondary" loading={turnOn.busy} onClick={() => void turnOn.run()}>Turn on</Button>}
    </div>
  );
}

/** Reminders only help if they arrive, so ask where it matters: next to a decision that's waiting. Asked once a device. */
const DISMISSED = 'ft-push-prompt-dismissed';
const dismissed = () => { try { return localStorage.getItem(DISMISSED) === '1'; } catch { return false; } };

export function PushPrompt() {
  const { state, turnOn } = usePush();
  const [hidden, setHidden] = useState(dismissed);
  if (state !== 'off' || hidden) return null;
  return (
    <div className="ft-card ft-card-pad flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <BellRing size={18} aria-hidden className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 basis-48">Want a reminder before a decision is overdue, even with the app closed?</span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => { try { localStorage.setItem(DISMISSED, '1'); } catch { /* fine: it asks again */ } setHidden(true); }}>Not now</Button>
        <Button size="sm" variant="secondary" loading={turnOn.busy} onClick={() => void turnOn.run()}>Turn on push</Button>
      </div>
    </div>
  );
}
