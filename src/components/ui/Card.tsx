import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={clsx('ft-card p-4', className)} {...p} />;
