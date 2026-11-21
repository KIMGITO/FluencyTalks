import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

/** The column a single-topic screen sits in. `withBar` leaves room for a fixed action bar at the bottom. */
export const Page = ({ withBar, className, ...p }: HTMLAttributes<HTMLDivElement> & { withBar?: boolean }) => (
  <div className={clsx('mx-auto w-full max-w-3xl p-4', withBar && 'pb-24', className)} {...p} />
);
