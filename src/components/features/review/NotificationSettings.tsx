import { Checkbox } from '@/components/ui';
import { userMessage } from '@/lib/errors';
import { setNotificationPrefs } from '@/services/review';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';
import { PushToggle } from './PushToggle';

const OPTIONAL: { key: string; label: string; hint: string }[] = [
  { key: 'corrections', label: 'Corrections and replies', hint: 'Someone challenges your correction, replies, or confirms your post.' },
  { key: 'decisions', label: 'Decisions', hint: 'Someone accepts or declines your correction.' },
  { key: 'system', label: 'Notices', hint: 'Partner requests, missed calls, ratings, levels and points.' },
];

/** Push for this device (phone or computer) and which notifications to get. On the Notifications page and in Settings. */
export function NotificationSettings() {
  const me = useProfileStore((s) => s.me);
  const reloadMe = useProfileStore((s) => s.load);
  const setPref = async (key: string, on: boolean) => {
    if (!me) return;
    try { await setNotificationPrefs({ ...(me.notification_prefs ?? {}), [key]: on }); await reloadMe(me.id); toast.success('Saved.'); }
    catch (e) { toast.error(userMessage(e)); }
  };
  return (
    <div className="space-y-2">
      <PushToggle />
      <p className="text-xs text-muted">Calls, decisions you have to make and restrictions always reach you.</p>
      {OPTIONAL.map((o) => (
        <Checkbox key={o.key} className="min-h-[2.75rem]" checked={me?.notification_prefs?.[o.key] !== false} onChange={(v) => void setPref(o.key, v)}>
          <span className="font-semibold">{o.label}</span><span className="block text-xs text-muted">{o.hint}</span>
        </Checkbox>
      ))}
    </div>
  );
}
