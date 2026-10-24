import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
type Props = HTMLAttributes<HTMLDivElement> & { pad?: boolean };

export const Card = ({ className, pad = true, ...p }: Props) => (
  <div className={clsx('ft-card', pad && 'ft-card-pad', className)} {...p} />
);
