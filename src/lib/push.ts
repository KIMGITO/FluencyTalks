import { rpc } from '@/lib/api';

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = 'unconfigured' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

const toBytes = (b64: string) => {
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iPhones only offer push to an app added to the Home Screen.
const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const installed = () => window.matchMedia('(display-mode: standalone)').matches;

const registration = () => navigator.serviceWorker.register('/sw.js');
const existing = async () => (await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription()) ?? null;

export async function pushState(): Promise<PushState> {
  if (!PUBLIC_KEY) return 'unconfigured';
  if (!supported()) return isIOS() && !installed() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return (await existing()) ? 'on' : 'off';
}

/** Asks for permission, so only ever call it from a tap. Resolves false if they said no. */
export async function enablePush(): Promise<boolean> {
  if (!PUBLIC_KEY || !supported()) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(PUBLIC_KEY) });
  const json = sub.toJSON();
  try {
    await rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth });
  } catch (e) {
    await sub.unsubscribe().catch(() => undefined);   // not recorded: don't leave the browser thinking it's on
    throw e;
  }
  return true;
}

export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const sub = await existing();
  if (!sub) return;
  await rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}
