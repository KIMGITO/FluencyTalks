import { Card } from '@/components/ui';
/** Visible on desktop only (lg+). Slot for suggestions, daily prompt, online friends. */
export const RightRail = () => (
  <aside className="sticky top-[var(--layout-topbarH)] hidden h-fit space-y-4 p-4 lg:block">
    <Card><h3 className="mb-1 font-semibold">Daily prompt</h3><p className="text-sm text-muted">What did you eat for breakfast today? Tell someone in your learning language.</p></Card>
    <Card><h3 className="mb-1 font-semibold">Online now</h3><p className="text-sm text-muted">People who are online will appear here.</p></Card>
  </aside>
);
