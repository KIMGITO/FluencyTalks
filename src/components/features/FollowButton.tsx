// FollowButton.tsx
import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { follow, unfollow, type FollowStatus } from '@/services';
import { actionBtn } from './ActionButtonStyle';

const labels = {
  none: 'Follow',
  pending: 'Requested',
  accepted: 'Following',
} as const;

const tone = {
  none: '',
  pending:
    '!bg-amber-50 !text-amber-200 !ring-1 !ring-inset !ring-amber-200 hover:!bg-amber-100',
  accepted:
    '!bg-emerald-50 !text-emerald-700 !ring-1 !ring-inset !ring-emerald-200 hover:!bg-emerald-100',
} as const;

export function FollowButton({
  userId,
  initial,
}: {
  userId: string;
  initial: FollowStatus | null;
}) {
  const [status, setStatus] = useState<FollowStatus | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (status) {
        await unfollow(userId);
        setStatus(null);
      } else {
        setStatus(await follow(userId));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const key = status ?? 'none';

  return (
    <div className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant={status ? 'secondary' : 'primary'}
        loading={busy}
        onClick={toggle}
        className={clsx(actionBtn, 'transition-colors', tone[key])}
      >
        {labels[key]}
      </Button>
      {error && (
        <span className="text-xs leading-tight text-danger">{error}</span>
      )}
    </div>
  );
}
