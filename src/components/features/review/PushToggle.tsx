import clsx from 'clsx';
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
    <div className="flex min-h-[2.75rem] flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-2 text-sm">
      <span className="min-w-0 flex-1 basis-[12rem]">
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

const COPY = {
  decisions: { ask: 'Want a reminder before a decision is overdue, even with the app closed?', key: 'ft-push-prompt-dismissed' },
  device: { ask: 'Get notifications on this device, even when this tab is closed.', key: 'ft-push-prompt-device-dismissed' },
  calls: { ask: 'Get calls even when the app or browser is closed. Your phone rings when a partner calls.', key: 'ft-push-prompt-calls-dismissed' },
} as const;
const dismissed = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };

/**
 * Asks for push where it matters: next to a decision that's waiting, or where calls start. The browser's own
 * permission question only appears after the tap. "Not now" hides it on this device. Blocked: say how to undo it.
 */
/** `flat`: inside another panel (the bell's dropdown), so no card of its own. */
export function PushPrompt({ reason = 'decisions', flat = false }: { reason?: keyof typeof COPY; flat?: boolean }) {
  const { state, turnOn } = usePush();
  const copy = COPY[reason];
  const [hidden, setHidden] = useState(() => dismissed(copy.key));
  if (hidden || (state !== 'off' && !(state === 'blocked' && reason === 'calls'))) return null;
  const hide = () => { try { localStorage.setItem(copy.key, '1'); } catch { /* fine: it asks again */ } setHidden(true); };
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-2 text-sm', flat ? 'border-b border-border px-4 py-3' : 'ft-card ft-card-pad')}>
      <BellRing size={18} aria-hidden className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 basis-[12rem]">{state === 'blocked'
        ? "Notifications are blocked, so calls can't reach you when the app is closed. Allow them in this site's settings (the icon next to the address)."
        : copy.ask}</span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" onClick={hide}>Not now</Button>
        {state === 'off' && <Button size="sm" variant="secondary" loading={turnOn.busy} onClick={() => void turnOn.run()}>Turn on</Button>}
      </div>
    </div>
  );
}
