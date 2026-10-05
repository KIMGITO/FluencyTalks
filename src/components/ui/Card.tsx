import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
type Props = HTMLAttributes<HTMLDivElement> & { pad?: boolean };
/**
 * Compact by default: `ft-card-pad` is 0.75rem on phones and 1rem from md up,
 * so cards stay tight on mobile without feeling cramped on laptops/tablets.
 * Pass `pad={false}` for cards that manage their own padding (lists, menus).
 */
export const Card = ({ className, pad = true, ...p }: Props) => (
  <div className={clsx('ft-card', pad && 'ft-card-pad', className)} {...p} />
);
