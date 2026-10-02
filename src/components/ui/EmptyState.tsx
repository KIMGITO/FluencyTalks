import type { ReactNode } from 'react';
import { Card } from './Card';
export const EmptyState = ({ title, text, action }: { title: string; text?: string; action?: ReactNode }) => (
  <Card className="flex flex-col items-center gap-2 py-10 text-center"><h3 className="font-semibold">{title}</h3>{text && <p className="max-w-sm text-muted">{text}</p>}{action}</Card>
);
