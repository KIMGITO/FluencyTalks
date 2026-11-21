import clsx from 'clsx';
import type { ReactNode } from 'react';

/** The one way a form or action says what went wrong. Renders nothing when there is no message. */
export const FormError = ({ children, small, className }: { children?: ReactNode; small?: boolean; className?: string }) =>
  children ? <p role="alert" className={clsx(small ? 'text-xs' : 'text-sm', 'text-danger', className)}>{children}</p> : null;
