import type { ReactNode } from 'react';
import { Card } from './Card';
export const EmptyState = ({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) => (
  <Card className="flex flex-col items-center gap-2 border-dashed py-8 text-center md:py-10">{icon}<h3 className="font-display text-xl font-medium">{title}</h3>{text && <p className="max-w-sm text-sm text-muted">{text}</p>}{action}</Card>
);
