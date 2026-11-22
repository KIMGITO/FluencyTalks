import type { ReactNode } from 'react';

/** The page title. `actions` (buttons such as "Mark all as read" or settings) sit on the same row, on the right. */
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="ft-inset mb-4 flex items-center gap-2 md:mb-6">
    <div className="min-w-0 flex-1">
      <h1 className="font-display text-3xl font-medium capitalize leading-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted md:text-base">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
  </div>
);
